// vt-pty: pty で子プロセスを起動し、その出力を libghostty-vt へ流してプロトコル状態を dump する。
// Tier B の spike。Pi を通した出力でしか再現しない不具合（#21 / #22 の APC 断片、#52 の SGR 汚染）を狙う。
//
// 使い方: vt-pty [--cols N] [--rows N] [--cell-w N] [--cell-h N]
//                [--settle-ms N] [--timeout-ms N] [--raw <file>] -- <command> [args...]
#define _GNU_SOURCE
#include <ghostty/vt.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>
#include "diacritics.h"

static int master_fd = -1;
static FILE *raw_sink = NULL;

// 端末からの応答（Kitty の a=q への OK、DA、DSR など）を pty へ書き戻す。
// これを返さないと Pi の probe が待ち続ける。
static void on_write_pty(GhosttyTerminal t, void *ud, const uint8_t *d, size_t n) {
  (void)t; (void)ud;
  if (master_fd >= 0) {
    size_t off = 0;
    while (off < n) {
      ssize_t w = write(master_fd, d + off, n - off);
      if (w <= 0) break;
      off += (size_t)w;
    }
  }
}

static uint32_t be32(const uint8_t *p) { return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3]; }

// PNG の IHDR だけ読み、寸法どおりのゼロ埋め RGBA を返す。プロトコル状態の検査には画素は要らない。
static bool decode_png_stub(void *ud, const GhosttyAllocator *a, const uint8_t *data, size_t len, GhosttySysImage *out) {
  (void)ud;
  if (len < 24 || memcmp(data, "\x89PNG", 4) != 0) return false;
  uint32_t w = be32(data + 16), h = be32(data + 20);
  size_t n = (size_t)w * h * 4;
  uint8_t *px = ghostty_alloc(a, n);
  if (!px) return false;
  memset(px, 0, n);
  out->width = w; out->height = h; out->data = px; out->data_len = n;
  return true;
}

static int diacritic_index(uint32_t cp) {
  for (size_t i = 0; i < DIACRITICS_LEN; i++) if (DIACRITICS[i] == cp) return (int)i;
  return -1;
}

static const char *tag_name(GhosttyStyleColorTag t) {
  return t == GHOSTTY_STYLE_COLOR_RGB ? "rgb" : t == GHOSTTY_STYLE_COLOR_PALETTE ? "palette" : "none";
}

static void dump_kitty(GhosttyTerminal term) {
  GhosttyKittyGraphics gfx = NULL;
  if (ghostty_terminal_get(term, GHOSTTY_TERMINAL_DATA_KITTY_GRAPHICS, &gfx) != GHOSTTY_SUCCESS || !gfx) {
    printf("kitty.placements=0 (no storage)\n"); return;
  }
  uint64_t gen = 0;
  ghostty_kitty_graphics_get(gfx, GHOSTTY_KITTY_GRAPHICS_DATA_GENERATION, &gen);
  printf("kitty.generation=%llu\n", (unsigned long long)gen);
  GhosttyKittyGraphicsPlacementIterator it = NULL;
  if (ghostty_kitty_graphics_placement_iterator_new(NULL, &it) != GHOSTTY_SUCCESS) { printf("kitty: iterator_new failed\n"); return; }
  GhosttyKittyPlacementLayer layer = GHOSTTY_KITTY_PLACEMENT_LAYER_ALL;
  ghostty_kitty_graphics_placement_iterator_set(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_ITERATOR_OPTION_LAYER, &layer);
  if (ghostty_kitty_graphics_get(gfx, GHOSTTY_KITTY_GRAPHICS_DATA_PLACEMENT_ITERATOR, &it) != GHOSTTY_SUCCESS) { printf("kitty: get iterator failed\n"); return; }
  int count = 0;
  while (ghostty_kitty_graphics_placement_next(it)) {
    uint32_t image_id = 0, placement_id = 0, cols = 0, rows = 0; bool virt = false; int32_t z = 0;
    ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_IMAGE_ID, &image_id);
    ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_PLACEMENT_ID, &placement_id);
    ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_IS_VIRTUAL, &virt);
    ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_COLUMNS, &cols);
    ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_ROWS, &rows);
    ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_Z, &z);
    printf("placement: image_id=0x%06x placement_id=0x%06x virtual=%d cols=%u rows=%u z=%d", image_id, placement_id, virt, cols, rows, z);
    GhosttyKittyGraphicsImage img = ghostty_kitty_graphics_image(gfx, image_id);
    if (img) {
      uint32_t w = 0, h = 0; GhosttyKittyImageFormat fmt = 0; size_t dl = 0;
      ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_WIDTH, &w);
      ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_HEIGHT, &h);
      ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_FORMAT, &fmt);
      ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_DATA_LEN, &dl);
      printf(" image={%ux%u format=%d bytes=%zu}", w, h, (int)fmt, dl);
    } else printf(" image=MISSING");
    printf("\n");
    count++;
  }
  printf("kitty.placements=%d\n", count);
  ghostty_kitty_graphics_placement_iterator_free(it);
}

// UTF-8 で 1 コードポイントを出す。CJK も本文として読めるようにする。
static size_t utf8_put(char *dst, uint32_t cp) {
  if (cp < 0x80) { dst[0] = (char)cp; return 1; }
  if (cp < 0x800) { dst[0] = (char)(0xc0 | (cp >> 6)); dst[1] = (char)(0x80 | (cp & 0x3f)); return 2; }
  if (cp < 0x10000) { dst[0] = (char)(0xe0 | (cp >> 12)); dst[1] = (char)(0x80 | ((cp >> 6) & 0x3f)); dst[2] = (char)(0x80 | (cp & 0x3f)); return 3; }
  dst[0] = (char)(0xf0 | (cp >> 18)); dst[1] = (char)(0x80 | ((cp >> 12) & 0x3f));
  dst[2] = (char)(0x80 | ((cp >> 6) & 0x3f)); dst[3] = (char)(0x80 | (cp & 0x3f)); return 4;
}

static void dump_cells(GhosttyTerminal term) {
  GhosttyRenderState st = NULL; GhosttyRenderStateRowIterator rows = NULL; GhosttyRenderStateRowCells cells = NULL;
  if (ghostty_render_state_new(NULL, &st) != GHOSTTY_SUCCESS) { printf("render_state_new failed\n"); return; }
  ghostty_render_state_row_iterator_new(NULL, &rows);
  ghostty_render_state_row_cells_new(NULL, &cells);
  if (ghostty_render_state_update(st, term) != GHOSTTY_SUCCESS) { printf("render_state_update failed\n"); return; }
  if (ghostty_render_state_get(st, GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR, &rows) != GHOSTTY_SUCCESS) { printf("row iterator failed\n"); return; }
  int r = 0, placeholders = 0, bad_underline = 0, dirty_placeholder = 0, apc_leak = 0;
  while (ghostty_render_state_row_iterator_next(rows)) {
    if (ghostty_render_state_row_get(rows, GHOSTTY_RENDER_STATE_ROW_DATA_CELLS, &cells) != GHOSTTY_SUCCESS) { r++; continue; }
    char text[2048]; size_t tl = 0; int c = 0, row_placeholders = 0;
    while (ghostty_render_state_row_cells_next(cells)) {
      uint32_t glen = 0;
      ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN, &glen);
      if (glen == 0) { c++; continue; }
      uint32_t cp[16] = {0};
      ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF, cp);
      if (cp[0] == 0x10EEEE) {
        GhosttyColorRgb fg = {0};
        GhosttyStyle style = GHOSTTY_INIT_SIZED(GhosttyStyle);
        ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR, &fg);
        ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE, &style);
        uint32_t id = ((uint32_t)fg.r << 16) | ((uint32_t)fg.g << 8) | fg.b;
        if (style.underline_color.tag != GHOSTTY_STYLE_COLOR_RGB) bad_underline++;
        // #52 の署名: placeholder セルに背景色や faint(dim) が乗っている。
        bool dirty = style.bg_color.tag != GHOSTTY_STYLE_COLOR_NONE || style.faint || style.inverse;
        if (dirty) {
          dirty_placeholder++;
          printf("cell[%d,%d]: DIRTY-PLACEHOLDER image_id=0x%06x row=%d col=%d bg=%s faint=%d inverse=%d underline_color=%s\n",
                 r, c, id, diacritic_index(cp[1]), diacritic_index(cp[2]),
                 tag_name(style.bg_color.tag), style.faint, style.inverse, tag_name(style.underline_color.tag));
        }
        placeholders++; row_placeholders++;
      } else if (tl < sizeof(text) - 8) {
        // #21 / #22 の署名: APC の断片が本文セルとして印字される。
        if (cp[0] == 0x1b || cp[0] == 0x9c) apc_leak++;
        tl += utf8_put(text + tl, cp[0]);
      }
      c++;
    }
    text[tl] = 0;
    if (tl || row_placeholders) printf("row[%d]: placeholders=%d \"%s\"\n", r, row_placeholders, text);
    r++;
  }
  printf("cells.placeholders=%d cells.underline_not_rgb=%d cells.dirty_placeholders=%d cells.apc_leak=%d\n",
         placeholders, bad_underline, dirty_placeholder, apc_leak);
  ghostty_render_state_row_cells_free(cells);
  ghostty_render_state_row_iterator_free(rows);
  ghostty_render_state_free(st);
}

static long now_ms(void) {
  struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1000L + ts.tv_nsec / 1000000L;
}

int main(int argc, char **argv) {
  int cols = 120, rows = 40, cell_w = 9, cell_h = 18;
  int settle_ms = 2000, timeout_ms = 60000;
  const char *raw_path = NULL;
  int i = 1;
  for (; i < argc; i++) {
    if (strcmp(argv[i], "--") == 0) { i++; break; }
    else if (strcmp(argv[i], "--cols") == 0 && i + 1 < argc) cols = atoi(argv[++i]);
    else if (strcmp(argv[i], "--rows") == 0 && i + 1 < argc) rows = atoi(argv[++i]);
    else if (strcmp(argv[i], "--cell-w") == 0 && i + 1 < argc) cell_w = atoi(argv[++i]);
    else if (strcmp(argv[i], "--cell-h") == 0 && i + 1 < argc) cell_h = atoi(argv[++i]);
    else if (strcmp(argv[i], "--settle-ms") == 0 && i + 1 < argc) settle_ms = atoi(argv[++i]);
    else if (strcmp(argv[i], "--timeout-ms") == 0 && i + 1 < argc) timeout_ms = atoi(argv[++i]);
    else if (strcmp(argv[i], "--raw") == 0 && i + 1 < argc) raw_path = argv[++i];
    else { fprintf(stderr, "unknown option: %s\n", argv[i]); return 2; }
  }
  if (i >= argc) { fprintf(stderr, "usage: vt-pty [options] -- <command> [args...]\n"); return 2; }

  ghostty_sys_set(GHOSTTY_SYS_OPT_DECODE_PNG, (const void *)decode_png_stub);

  GhosttyTerminal term = NULL;
  if (ghostty_terminal_new(NULL, &term, (uint16_t)cols, (uint16_t)rows) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "terminal_new failed\n"); return 2;
  }
  ghostty_terminal_resize(term, (uint16_t)cols, (uint16_t)rows, (uint32_t)cell_w, (uint32_t)cell_h);
  ghostty_terminal_set(term, GHOSTTY_TERMINAL_OPT_WRITE_PTY, (const void *)on_write_pty);
  uint64_t limit = 256u << 20;
  ghostty_terminal_set(term, GHOSTTY_TERMINAL_OPT_KITTY_IMAGE_STORAGE_LIMIT, &limit);

  if (raw_path) raw_sink = fopen(raw_path, "wb");

  // pty の winsize は VT の寸法と一致させる。Pi の getCellDimensions() が
  // 応答を得られない場合の既定 9x18 とも合わせる。
  struct winsize ws = {0};
  ws.ws_col = (unsigned short)cols; ws.ws_row = (unsigned short)rows;
  ws.ws_xpixel = (unsigned short)(cols * cell_w); ws.ws_ypixel = (unsigned short)(rows * cell_h);

  pid_t pid = forkpty(&master_fd, NULL, NULL, &ws);
  if (pid < 0) { perror("forkpty"); return 2; }
  if (pid == 0) {
    setenv("TERM", "xterm-ghostty", 1);
    setenv("COLORTERM", "truecolor", 1);
    setenv("CI", "", 1);
    execvp(argv[i], argv + i);
    perror(argv[i]);
    _exit(127);
  }

  long start = now_ms(), last_data = start;
  bool saw_data = false;
  uint8_t buf[65536];
  for (;;) {
    long now = now_ms();
    if (now - start > timeout_ms) { fprintf(stderr, "vt-pty: timeout %dms\n", timeout_ms); break; }
    if (saw_data && now - last_data > settle_ms) break;
    struct pollfd p = {.fd = master_fd, .events = POLLIN};
    int rc = poll(&p, 1, 200);
    if (rc < 0) { if (errno == EINTR) continue; perror("poll"); break; }
    if (rc == 0) continue;
    ssize_t n = read(master_fd, buf, sizeof(buf));
    if (n <= 0) { if (n < 0 && errno == EINTR) continue; break; }
    if (raw_sink) fwrite(buf, 1, (size_t)n, raw_sink);
    ghostty_terminal_vt_write(term, buf, (size_t)n);
    saw_data = true;
    last_data = now_ms();
  }

  kill(pid, SIGTERM);
  int status = 0;
  for (int k = 0; k < 20 && waitpid(pid, &status, WNOHANG) == 0; k++) usleep(50000);
  kill(pid, SIGKILL);
  waitpid(pid, &status, 0);
  if (raw_sink) fclose(raw_sink);

  printf("== vt-pty %dx%d cell %dx%d ==\n", cols, rows, cell_w, cell_h);
  dump_kitty(term);
  dump_cells(term);
  ghostty_terminal_free(term);
  close(master_fd);
  return 0;
}

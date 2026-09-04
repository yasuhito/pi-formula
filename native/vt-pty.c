// vt-pty: pty で子プロセスを起動し、その出力を libghostty-vt へ流してプロトコル状態を dump する。
// エンコーダ層（Tier A）と Pi を通した出力（Tier B）のプロトコル状態を検査する。
//
// 使い方: vt-pty [--cols N] [--rows N] [--cell-w N] [--cell-h N]
//                [--settle-ms N] [--timeout-ms N] [--wait-for-placements N]
//                [--wait-for-render-boundary] [--raw <file>] -- <command> [args...]
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
static bool pty_write_failed = false;

// 端末からの応答（Kitty の a=q への OK、DA、DSR など）を pty へ書き戻す。
// これを返さないと Pi の probe が待ち続ける。
static void on_write_pty(GhosttyTerminal t, void *ud, const uint8_t *d, size_t n) {
  (void)t; (void)ud;
  if (master_fd < 0) return;
  size_t off = 0;
  while (off < n) {
    ssize_t w = write(master_fd, d + off, n - off);
    if (w < 0 && errno == EINTR) continue;
    if (w <= 0) {
      pty_write_failed = true;
      return;
    }
    off += (size_t)w;
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

static bool kitty_placement_count(GhosttyTerminal term, int *count) {
  GhosttyKittyGraphics gfx = NULL;
  if (ghostty_terminal_get(term, GHOSTTY_TERMINAL_DATA_KITTY_GRAPHICS, &gfx) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: kitty graphics query failed\n"); return false;
  }
  *count = 0;
  if (!gfx) return true;
  GhosttyKittyGraphicsPlacementIterator it = NULL;
  if (ghostty_kitty_graphics_placement_iterator_new(NULL, &it) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: kitty iterator allocation failed\n"); return false;
  }
  GhosttyKittyPlacementLayer layer = GHOSTTY_KITTY_PLACEMENT_LAYER_ALL;
  bool ok = ghostty_kitty_graphics_placement_iterator_set(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_ITERATOR_OPTION_LAYER, &layer) == GHOSTTY_SUCCESS &&
    ghostty_kitty_graphics_get(gfx, GHOSTTY_KITTY_GRAPHICS_DATA_PLACEMENT_ITERATOR, &it) == GHOSTTY_SUCCESS;
  if (ok) while (ghostty_kitty_graphics_placement_next(it)) (*count)++;
  ghostty_kitty_graphics_placement_iterator_free(it);
  if (!ok) fprintf(stderr, "vt-pty: kitty iterator setup failed\n");
  return ok;
}

static bool dump_kitty(GhosttyTerminal term) {
  GhosttyKittyGraphics gfx = NULL;
  if (ghostty_terminal_get(term, GHOSTTY_TERMINAL_DATA_KITTY_GRAPHICS, &gfx) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: kitty graphics query failed\n"); return false;
  }
  if (!gfx) { printf("kitty.placements=0 (no storage)\n"); return true; }
  uint64_t gen = 0;
  if (ghostty_kitty_graphics_get(gfx, GHOSTTY_KITTY_GRAPHICS_DATA_GENERATION, &gen) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: kitty generation query failed\n"); return false;
  }
  printf("kitty.generation=%llu\n", (unsigned long long)gen);
  GhosttyKittyGraphicsPlacementIterator it = NULL;
  if (ghostty_kitty_graphics_placement_iterator_new(NULL, &it) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: kitty iterator allocation failed\n"); return false;
  }
  GhosttyKittyPlacementLayer layer = GHOSTTY_KITTY_PLACEMENT_LAYER_ALL;
  bool ok = ghostty_kitty_graphics_placement_iterator_set(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_ITERATOR_OPTION_LAYER, &layer) == GHOSTTY_SUCCESS &&
    ghostty_kitty_graphics_get(gfx, GHOSTTY_KITTY_GRAPHICS_DATA_PLACEMENT_ITERATOR, &it) == GHOSTTY_SUCCESS;
  if (!ok) {
    fprintf(stderr, "vt-pty: kitty iterator setup failed\n");
    ghostty_kitty_graphics_placement_iterator_free(it); return false;
  }
  int count = 0;
  while (ghostty_kitty_graphics_placement_next(it)) {
    uint32_t image_id = 0, placement_id = 0, cols = 0, rows = 0; bool virt = false; int32_t z = 0;
    ok = ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_IMAGE_ID, &image_id) == GHOSTTY_SUCCESS &&
      ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_PLACEMENT_ID, &placement_id) == GHOSTTY_SUCCESS &&
      ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_IS_VIRTUAL, &virt) == GHOSTTY_SUCCESS &&
      ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_COLUMNS, &cols) == GHOSTTY_SUCCESS &&
      ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_ROWS, &rows) == GHOSTTY_SUCCESS &&
      ghostty_kitty_graphics_placement_get(it, GHOSTTY_KITTY_GRAPHICS_PLACEMENT_DATA_Z, &z) == GHOSTTY_SUCCESS;
    if (!ok) break;
    printf("placement: image_id=0x%06x placement_id=0x%06x virtual=%d cols=%u rows=%u z=%d", image_id, placement_id, virt, cols, rows, z);
    GhosttyKittyGraphicsImage img = ghostty_kitty_graphics_image(gfx, image_id);
    if (img) {
      uint32_t w = 0, h = 0; GhosttyKittyImageFormat fmt = 0; size_t dl = 0;
      ok = ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_WIDTH, &w) == GHOSTTY_SUCCESS &&
        ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_HEIGHT, &h) == GHOSTTY_SUCCESS &&
        ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_FORMAT, &fmt) == GHOSTTY_SUCCESS &&
        ghostty_kitty_graphics_image_get(img, GHOSTTY_KITTY_IMAGE_DATA_DATA_LEN, &dl) == GHOSTTY_SUCCESS;
      if (!ok) break;
      printf(" image={%ux%u format=%d bytes=%zu}", w, h, (int)fmt, dl);
    } else printf(" image=MISSING");
    printf("\n"); count++;
  }
  ghostty_kitty_graphics_placement_iterator_free(it);
  if (!ok) { fprintf(stderr, "vt-pty: kitty data query failed\n"); return false; }
  printf("kitty.placements=%d\n", count);
  return true;
}

// UTF-8 で 1 コードポイントを出す。CJK も本文として読めるようにする。
static size_t utf8_put(char *dst, uint32_t cp) {
  if (cp < 0x80) { dst[0] = (char)cp; return 1; }
  if (cp < 0x800) { dst[0] = (char)(0xc0 | (cp >> 6)); dst[1] = (char)(0x80 | (cp & 0x3f)); return 2; }
  if (cp < 0x10000) { dst[0] = (char)(0xe0 | (cp >> 12)); dst[1] = (char)(0x80 | ((cp >> 6) & 0x3f)); dst[2] = (char)(0x80 | (cp & 0x3f)); return 3; }
  dst[0] = (char)(0xf0 | (cp >> 18)); dst[1] = (char)(0x80 | ((cp >> 12) & 0x3f));
  dst[2] = (char)(0x80 | ((cp >> 6) & 0x3f)); dst[3] = (char)(0x80 | (cp & 0x3f)); return 4;
}

static bool dump_cells(GhosttyTerminal term) {
  GhosttyRenderState st = NULL; GhosttyRenderStateRowIterator rows = NULL; GhosttyRenderStateRowCells cells = NULL;
  bool ok = ghostty_render_state_new(NULL, &st) == GHOSTTY_SUCCESS &&
    ghostty_render_state_row_iterator_new(NULL, &rows) == GHOSTTY_SUCCESS &&
    ghostty_render_state_row_cells_new(NULL, &cells) == GHOSTTY_SUCCESS &&
    ghostty_render_state_update(st, term) == GHOSTTY_SUCCESS &&
    ghostty_render_state_get(st, GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR, &rows) == GHOSTTY_SUCCESS;
  if (!ok) { fprintf(stderr, "vt-pty: render state setup failed\n"); goto cleanup; }
  int r = 0, placeholders = 0, bad_underline = 0, dirty_placeholder = 0, apc_leak = 0;
  while (ok && ghostty_render_state_row_iterator_next(rows)) {
    if (ghostty_render_state_row_get(rows, GHOSTTY_RENDER_STATE_ROW_DATA_CELLS, &cells) != GHOSTTY_SUCCESS) {
      fprintf(stderr, "vt-pty: row cells query failed\n"); ok = false; break;
    }
    char text[2048]; size_t tl = 0; int c = 0, row_placeholders = 0;
    while (ok && ghostty_render_state_row_cells_next(cells)) {
      uint32_t glen = 0;
      if (ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN, &glen) != GHOSTTY_SUCCESS) {
        fprintf(stderr, "vt-pty: grapheme length query failed\n"); ok = false; break;
      }
      if (glen == 0) { c++; continue; }
      if (glen > SIZE_MAX / sizeof(uint32_t)) {
        fprintf(stderr, "vt-pty: grapheme is too large\n"); ok = false; break;
      }
      uint32_t *cp = calloc((size_t)glen, sizeof(uint32_t));
      if (!cp) { fprintf(stderr, "vt-pty: grapheme allocation failed\n"); ok = false; break; }
      if (ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF, cp) != GHOSTTY_SUCCESS) {
        fprintf(stderr, "vt-pty: grapheme query failed\n"); free(cp); ok = false; break;
      }
      if (cp[0] == 0x10EEEE) {
        GhosttyColorRgb fg = {0};
        GhosttyStyle style = GHOSTTY_INIT_SIZED(GhosttyStyle);
        ok = ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR, &fg) == GHOSTTY_SUCCESS &&
          ghostty_render_state_row_cells_get(cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE, &style) == GHOSTTY_SUCCESS;
        if (!ok) { fprintf(stderr, "vt-pty: placeholder style query failed\n"); free(cp); break; }
        uint32_t id = ((uint32_t)fg.r << 16) | ((uint32_t)fg.g << 8) | fg.b;
        int row = glen > 1 ? diacritic_index(cp[1]) : -1;
        int col = glen > 2 ? diacritic_index(cp[2]) : -1;
        printf("placeholder: image_id=0x%06x row=%d col=%d fg=rgb(%u,%u,%u) underline_color=%s\n",
               id, row, col, fg.r, fg.g, fg.b, tag_name(style.underline_color.tag));
        if (style.underline_color.tag != GHOSTTY_STYLE_COLOR_RGB) bad_underline++;
        bool dirty = style.bg_color.tag != GHOSTTY_STYLE_COLOR_NONE || style.faint || style.inverse;
        if (dirty) {
          dirty_placeholder++;
          printf("cell[%d,%d]: DIRTY-PLACEHOLDER image_id=0x%06x row=%d col=%d bg=%s faint=%d inverse=%d underline_color=%s\n",
                 r, c, id, row, col, tag_name(style.bg_color.tag), style.faint, style.inverse, tag_name(style.underline_color.tag));
        }
        placeholders++; row_placeholders++;
      } else if (tl < sizeof(text) - 8) {
        if (cp[0] == 0x1b || cp[0] == 0x9c) apc_leak++;
        tl += utf8_put(text + tl, cp[0]);
      }
      free(cp); c++;
    }
    text[tl] = 0;
    if (tl || row_placeholders) printf("row[%d]: placeholders=%d \"%s\"\n", r, row_placeholders, text);
    r++;
  }
  if (ok) printf("cells.placeholders=%d cells.underline_not_rgb=%d cells.dirty_placeholders=%d cells.apc_leak=%d\n",
                 placeholders, bad_underline, dirty_placeholder, apc_leak);
cleanup:
  ghostty_render_state_row_cells_free(cells);
  ghostty_render_state_row_iterator_free(rows);
  ghostty_render_state_free(st);
  return ok;
}

static long now_ms(void) {
  struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1000L + ts.tv_nsec / 1000000L;
}

typedef struct {
  uint64_t offset, last_kitty_end, last_sync_end;
  size_t kitty_prefix, sync_prefix;
  bool in_kitty, kitty_escape;
} OutputBoundary;

static void observe_output_boundary(OutputBoundary *state, const uint8_t *data, size_t len) {
  static const uint8_t kitty_start[] = {0x1b, '_', 'G'};
  static const uint8_t sync_end[] = {0x1b, '[', '?', '2', '0', '2', '6', 'l'};
  for (size_t i = 0; i < len; i++) {
    uint8_t byte = data[i];
    state->offset++;
    if (state->in_kitty) {
      if (state->kitty_escape && byte == '\\') {
        state->in_kitty = false;
        state->kitty_escape = false;
        state->last_kitty_end = state->offset;
      } else state->kitty_escape = byte == 0x1b;
    } else if (byte == kitty_start[state->kitty_prefix]) {
      if (++state->kitty_prefix == sizeof(kitty_start)) {
        state->in_kitty = true;
        state->kitty_escape = false;
        state->kitty_prefix = 0;
      }
    } else state->kitty_prefix = byte == kitty_start[0] ? 1 : 0;

    if (byte == sync_end[state->sync_prefix]) {
      if (++state->sync_prefix == sizeof(sync_end)) {
        state->last_sync_end = state->offset;
        state->sync_prefix = 0;
      }
    } else state->sync_prefix = byte == sync_end[0] ? 1 : 0;
  }
}

static bool render_boundary_after_kitty(const OutputBoundary *state) {
  return state->last_kitty_end > 0 && state->last_sync_end > state->last_kitty_end;
}

int main(int argc, char **argv) {
  int cols = 120, rows = 40, cell_w = 9, cell_h = 18;
  int settle_ms = 2000, timeout_ms = 60000, wait_for_placements = 0;
  bool wait_for_render_boundary = false;
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
    else if (strcmp(argv[i], "--wait-for-placements") == 0 && i + 1 < argc) wait_for_placements = atoi(argv[++i]);
    else if (strcmp(argv[i], "--wait-for-render-boundary") == 0) wait_for_render_boundary = true;
    else if (strcmp(argv[i], "--raw") == 0 && i + 1 < argc) raw_path = argv[++i];
    else { fprintf(stderr, "unknown option: %s\n", argv[i]); return 2; }
  }
  if (i >= argc) { fprintf(stderr, "usage: vt-pty [options] -- <command> [args...]\n"); return 2; }
  if (wait_for_placements < 0) { fprintf(stderr, "vt-pty: --wait-for-placements must not be negative\n"); return 2; }
  if (wait_for_render_boundary && wait_for_placements <= 0) {
    fprintf(stderr, "vt-pty: --wait-for-render-boundary requires --wait-for-placements\n"); return 2;
  }

  if (ghostty_sys_set(GHOSTTY_SYS_OPT_DECODE_PNG, (const void *)decode_png_stub) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: PNG decoder setup failed\n"); return 2;
  }

  GhosttyTerminal term = NULL;
  if (ghostty_terminal_new(NULL, &term, (uint16_t)cols, (uint16_t)rows) != GHOSTTY_SUCCESS) {
    fprintf(stderr, "vt-pty: terminal allocation failed\n"); return 2;
  }
  uint64_t limit = 256u << 20;
  bool terminal_ready = ghostty_terminal_resize(term, (uint16_t)cols, (uint16_t)rows, (uint32_t)cell_w, (uint32_t)cell_h) == GHOSTTY_SUCCESS &&
    ghostty_terminal_set(term, GHOSTTY_TERMINAL_OPT_WRITE_PTY, (const void *)on_write_pty) == GHOSTTY_SUCCESS &&
    ghostty_terminal_set(term, GHOSTTY_TERMINAL_OPT_KITTY_IMAGE_STORAGE_LIMIT, &limit) == GHOSTTY_SUCCESS;
  if (!terminal_ready) {
    fprintf(stderr, "vt-pty: terminal setup failed\n"); ghostty_terminal_free(term); return 2;
  }

  if (raw_path) {
    raw_sink = fopen(raw_path, "wb");
    if (!raw_sink) { perror(raw_path); ghostty_terminal_free(term); return 2; }
  }

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
  bool saw_data = false, settled = false;
  int result = 0, observed_placements = 0;
  OutputBoundary output_boundary = {0};
  uint8_t buf[65536];
  for (;;) {
    long now = now_ms();
    if (now - start > timeout_ms) {
      if (wait_for_placements > 0) {
        if (!kitty_placement_count(term, &observed_placements)) { result = 2; break; }
        if (wait_for_render_boundary && observed_placements >= wait_for_placements)
          fprintf(stderr, "vt-pty: timeout %dms waiting for render boundary after %d placements (observed %d)\n", timeout_ms, wait_for_placements, observed_placements);
        else fprintf(stderr, "vt-pty: timeout %dms waiting for %d placements (observed %d)\n", timeout_ms, wait_for_placements, observed_placements);
      } else fprintf(stderr, "vt-pty: timeout %dms\n", timeout_ms);
      result = 2; break;
    }
    if (saw_data && now - last_data > settle_ms) {
      if (wait_for_placements <= 0) { settled = true; break; }
      if (!kitty_placement_count(term, &observed_placements)) { result = 2; break; }
      if (observed_placements >= wait_for_placements &&
          (!wait_for_render_boundary || render_boundary_after_kitty(&output_boundary))) {
        settled = true; break;
      }
    }
    struct pollfd p = {.fd = master_fd, .events = POLLIN};
    int rc = poll(&p, 1, 200);
    if (rc < 0) { if (errno == EINTR) continue; perror("poll"); result = 2; break; }
    if (rc == 0) continue;
    ssize_t n = read(master_fd, buf, sizeof(buf));
    if (n < 0 && errno == EINTR) continue;
    if (n < 0 && errno != EIO) { perror("read pty"); result = 2; }
    if (n <= 0) break;
    if (raw_sink && fwrite(buf, 1, (size_t)n, raw_sink) != (size_t)n) {
      perror("write raw output"); result = 2; break;
    }
    observe_output_boundary(&output_boundary, buf, (size_t)n);
    ghostty_terminal_vt_write(term, buf, (size_t)n);
    if (pty_write_failed) {
      fprintf(stderr, "vt-pty: terminal response write failed\n"); result = 2; break;
    }
    if (wait_for_placements > 0) {
      if (!kitty_placement_count(term, &observed_placements)) { result = 2; break; }
      if (wait_for_render_boundary && observed_placements >= wait_for_placements &&
          render_boundary_after_kitty(&output_boundary)) {
        settled = true; break;
      }
    }
    saw_data = true;
    last_data = now_ms();
  }

  int status = 0;
  pid_t waited = waitpid(pid, &status, WNOHANG);
  bool child_reaped = waited == pid;
  if (waited < 0) { perror("waitpid"); result = 2; }
  while (!child_reaped && !settled && result == 0 && now_ms() - start <= timeout_ms) {
    usleep(10000);
    waited = waitpid(pid, &status, WNOHANG);
    if (waited == pid) child_reaped = true;
    else if (waited < 0) { perror("waitpid"); result = 2; }
  }
  if (!child_reaped && !settled && result == 0) {
    fprintf(stderr, "vt-pty: timeout %dms\n", timeout_ms); result = 2;
  }
  if (!child_reaped) {
    if (kill(pid, SIGTERM) < 0 && errno != ESRCH) { perror("kill"); result = 2; }
    for (int k = 0; k < 20; k++) {
      waited = waitpid(pid, &status, WNOHANG);
      if (waited == pid) { child_reaped = true; break; }
      if (waited < 0) { perror("waitpid"); result = 2; break; }
      usleep(50000);
    }
  }
  if (!child_reaped) {
    if (kill(pid, SIGKILL) < 0 && errno != ESRCH) { perror("kill"); result = 2; }
    if (waitpid(pid, &status, 0) == pid) child_reaped = true;
    else { perror("waitpid"); result = 2; }
  }
  if (!settled && child_reaped && (!WIFEXITED(status) || WEXITSTATUS(status) != 0)) {
    if (WIFEXITED(status)) fprintf(stderr, "vt-pty: child exited with status %d\n", WEXITSTATUS(status));
    else if (WIFSIGNALED(status)) fprintf(stderr, "vt-pty: child stopped by signal %d\n", WTERMSIG(status));
    result = 2;
  }
  if (raw_sink && fclose(raw_sink) != 0) { perror("close raw output"); result = 2; }

  if (result == 0) {
    printf("== vt-pty %dx%d cell %dx%d ==\n", cols, rows, cell_w, cell_h);
    if (!dump_kitty(term) || !dump_cells(term)) result = 2;
  }
  ghostty_terminal_free(term);
  if (close(master_fd) < 0) { perror("close pty"); result = 2; }
  return result;
}

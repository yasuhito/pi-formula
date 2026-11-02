#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

#include "diacritics.h"

int main(void) {
  printf("%zu\n", DIACRITICS_LEN);
  for (size_t index = 0; index < DIACRITICS_LEN; index++) {
    printf("%" PRIu32 "\n", DIACRITICS[index]);
  }
  return 0;
}

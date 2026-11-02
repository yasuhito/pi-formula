#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

#include "diacritics.h"

int main(void) {
  const size_t actual_length = sizeof DIACRITICS / sizeof DIACRITICS[0];
  printf("%zu\n", DIACRITICS_LEN);
  for (size_t index = 0; index < actual_length; index++) {
    printf("%" PRIu32 "\n", DIACRITICS[index]);
  }
  return 0;
}

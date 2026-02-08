import type { ZeroOptions } from '@rocicorp/zero'

import { mutators } from '@app/core/mutators'
import { schema } from '@app/core/zero-schema'

const cacheURL =
  import.meta.env.VITE_ZERO_CACHE_URL ?? 'http://localhost:4848'

export const zeroOptions: ZeroOptions = {
  schema,
  mutators,
  cacheURL,
  userID: 'anon',
  kvStore: 'idb',
}

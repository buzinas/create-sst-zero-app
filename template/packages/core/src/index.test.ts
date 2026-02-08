import { expect, test } from 'vitest'

import { APP_NAME } from './index'

test('APP_NAME is Zero App', () => {
  expect(APP_NAME).toBe('Zero App')
})

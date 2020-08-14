#!/usr/bin/env node

// Usage:
// yarn create grandstack-app mynewapp
// inspired by create-redwood-app

import {
  parseArgumentsIntoOptions,
  promptForMissingOptions,
  createApp,
} from './utils'

export async function cli(args) {
  const options = parseArgumentsIntoOptions(args)
  const prompted = await promptForMissingOptions(options)
  createApp(prompted)
}

import {Config} from '@remotion/cli/config'
import {enableTailwind} from '@remotion/tailwind-v4'

Config.overrideWebpackConfig((current) => enableTailwind(current))

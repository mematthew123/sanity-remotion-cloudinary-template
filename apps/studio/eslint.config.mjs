import studio from '@sanity/eslint-config-studio'

export default [
  {
    ignores: ['node_modules', 'dist', '.sanity'],
  },
  ...studio,
]

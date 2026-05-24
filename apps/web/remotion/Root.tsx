import React from 'react'
import {Composition} from 'remotion'
// Root is the ONLY file that may import the package barrel: it needs the React
// composition components. Server routes import from `@template/video-core/registry`
// instead (React-free metadata) so Remotion hooks never evaluate at module load.
import {COMPOSITIONS, COMPOSITION_COMPONENTS} from '@template/video-core'

export const Root: React.FC = () => (
  <>
    {COMPOSITIONS.map((c) => (
      <Composition
        key={c.id}
        id={c.id}
        component={COMPOSITION_COMPONENTS[c.id]}
        durationInFrames={c.defaultDurationFrames}
        fps={c.fps}
        width={c.width}
        height={c.height}
        schema={c.schema}
        defaultProps={c.defaultProps}
      />
    ))}
  </>
)

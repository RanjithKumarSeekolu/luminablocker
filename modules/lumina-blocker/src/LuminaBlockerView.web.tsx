import * as React from 'react';

import { LuminaBlockerViewProps } from './LuminaBlocker.types';

export default function LuminaBlockerView(props: LuminaBlockerViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}

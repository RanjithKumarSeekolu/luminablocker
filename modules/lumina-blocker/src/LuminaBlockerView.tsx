import { requireNativeView } from 'expo';
import * as React from 'react';

import { LuminaBlockerViewProps } from './LuminaBlocker.types';

const NativeView: React.ComponentType<LuminaBlockerViewProps> =
  requireNativeView('LuminaBlocker');

export default function LuminaBlockerView(props: LuminaBlockerViewProps) {
  return <NativeView {...props} />;
}

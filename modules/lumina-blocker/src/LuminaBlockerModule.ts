import { NativeModule, requireNativeModule } from 'expo';

import { LuminaBlockerModuleEvents } from './LuminaBlocker.types';

declare class LuminaBlockerModule extends NativeModule<LuminaBlockerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<LuminaBlockerModule>('LuminaBlocker');

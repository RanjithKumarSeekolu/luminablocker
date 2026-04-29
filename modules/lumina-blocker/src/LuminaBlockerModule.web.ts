import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './LuminaBlocker.types';

type LuminaBlockerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class LuminaBlockerModule extends NativeModule<LuminaBlockerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(LuminaBlockerModule, 'LuminaBlockerModule');

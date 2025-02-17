/* globals globalThis */
import { Script } from '../Script';
import { ScriptManager } from '../ScriptManager';

jest.mock('react-native', () => ({ NativeModules: {} }));

// @ts-ignore
globalThis.__webpack_require__ = {
  u: (id: string) => `${id}.chunk.bundle`,
  p: '',
  repack: { shared: { loadScriptCallback: [] } },
};

class FakeCache {
  data: Record<string, string> = {};

  async setItem(key: string, value: string) {
    this.data[key] = value;
  }

  async getItem(key: string) {
    return this.data[key] ?? null;
  }

  async removeItem(key: string) {
    delete this.data[key];
  }
}

beforeEach(() => {
  try {
    ScriptManager.shared.__destroy();
  } catch {
    // NOOP
  }
});

describe('ScriptManagerAPI', () => {
  it('throw error if there are no resolvers', async () => {
    await expect(
      ScriptManager.shared.resolveScript('src_App_js', 'main')
    ).rejects.toThrow(/Error: No script resolvers were added/);
  });

  it('throw error if no resolvers handled request', async () => {
    ScriptManager.shared.addResolver(async () => undefined);
    ScriptManager.shared.addResolver(async () => undefined);

    await expect(
      ScriptManager.shared.resolveScript('src_App_js', 'main')
    ).rejects.toThrow(/No resolver was able to resolve script src_App_js/);
  });

  it('remove all resolvers', async () => {
    ScriptManager.shared.addResolver(async () => undefined);
    ScriptManager.shared.addResolver(async () => undefined);
    ScriptManager.shared.removeAllResolvers();

    await expect(
      ScriptManager.shared.resolveScript('src_App_js', 'main')
    ).rejects.toThrow(/Error: No script resolvers were added/);
  });

  it('should resolve with url only', async () => {
    const cache = new FakeCache();

    ScriptManager.shared.setStorage(cache);
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
      };
    });

    const script = await ScriptManager.shared.resolveScript(
      'src_App_js',
      'main'
    );
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'GET',
      timeout: Script.DEFAULT_TIMEOUT,
    });

    const {
      locator: { fetch },
    } = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(fetch).toBe(false);

    ScriptManager.shared.removeAllResolvers();

    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/subpath/${scriptId}`),
      };
    });

    const newScript = await ScriptManager.shared.resolveScript(
      'src_App_js',
      'main'
    );
    expect(newScript.locator).toEqual({
      url: 'http://domain.ext/subpath/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'GET',
      timeout: Script.DEFAULT_TIMEOUT,
    });
  });

  it('should resolve with custom extension', async () => {
    const cache = new FakeCache();
    ScriptManager.shared.setStorage(cache);
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}.js`, {
          excludeExtension: true,
        }),
      };
    });

    const script = await ScriptManager.shared.resolveScript(
      'src_App_js',
      'main'
    );
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.js',
      fetch: true,
      absolute: false,
      method: 'GET',
      timeout: Script.DEFAULT_TIMEOUT,
    });
  });

  it('should resolve with query', async () => {
    const cache = new FakeCache();
    ScriptManager.shared.setStorage(cache);
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
        query: {
          accessCode: '1234',
          accessUid: 'asdf',
        },
      };
    });

    let script = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'GET',
      query: 'accessCode=1234&accessUid=asdf',
      timeout: Script.DEFAULT_TIMEOUT,
    });

    ScriptManager.shared.removeAllResolvers();
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
        query: 'token=some_token',
      };
    });

    script = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(script.locator.fetch).toBe(true);
    expect(script.locator.query).toEqual('token=some_token');
  });

  it('should resolve with headers', async () => {
    const cache = new FakeCache();
    ScriptManager.shared.setStorage(cache);
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
        headers: {
          'x-hello': 'world',
        },
      };
    });

    let script = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'GET',
      headers: { 'x-hello': 'world' },
      timeout: Script.DEFAULT_TIMEOUT,
    });

    ScriptManager.shared.removeAllResolvers();
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
        headers: {
          'x-hello': 'world',
          'x-changed': 'true',
        },
      };
    });

    script = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'GET',
      headers: { 'x-hello': 'world', 'x-changed': 'true' },
      timeout: Script.DEFAULT_TIMEOUT,
    });
  });

  it('should resolve with body', async () => {
    const cache = new FakeCache();
    ScriptManager.shared.setStorage(cache);
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
        method: 'POST',
        body: 'hello_world',
      };
    });

    let script = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'POST',
      body: 'hello_world',
      timeout: Script.DEFAULT_TIMEOUT,
    });

    ScriptManager.shared.removeAllResolvers();
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getRemoteURL(`http://domain.ext/${scriptId}`),
        method: 'POST',
        body: 'message',
      };
    });

    script = await ScriptManager.shared.resolveScript('src_App_js', 'main');
    expect(script.locator).toEqual({
      url: 'http://domain.ext/src_App_js.chunk.bundle',
      fetch: true,
      absolute: false,
      method: 'POST',
      body: 'message',
      timeout: Script.DEFAULT_TIMEOUT,
    });
  });

  it('should resolve with absolute path', async () => {
    const cache = new FakeCache();
    ScriptManager.shared.setStorage(cache);
    ScriptManager.shared.addResolver(async (scriptId, caller) => {
      expect(caller).toEqual('main');

      return {
        url: Script.getFileSystemURL(`absolute/directory/${scriptId}`),
        cache: false,
        method: 'POST',
        absolute: true,
      };
    });

    const script = await ScriptManager.shared.resolveScript(
      'src_App_js',
      'main'
    );
    expect(script.locator).toEqual({
      url: 'file:///absolute/directory/src_App_js.chunk.bundle',
      fetch: true,
      absolute: true,
      method: 'POST',
      timeout: Script.DEFAULT_TIMEOUT,
    });
  });
});

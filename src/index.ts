import * as utils from './utils';

const APP_PROXY_METHODS = ['onLaunch', 'onShow', 'onHide', 'onError', 'onShareAppMessage', 'onUnhandledRejection'];

const PAGE_PROXY_METHODS = ['onLoad', 'onShow', 'onReady', 'onHide', 'onUnload', 'onTitleClick', 'onPullDownRefresh', 'onReachBottom', 'onShareAppMessage'];

const PAGE_EVENTS_PROXY_METHODS = ['onBack'];

/**
 * 将event挂载到App，防止重复引用minitap导致事件多次触发
 */
const event = App.__minitap_event = App.__minitap_event || utils.event;

/**
 * 创建方法代理
 * @param method 如果不存在则新建一个function
 * @param callback
 */
function createMethodProxy(method, callback) {
  return new Proxy(method || function () {}, {
    apply(func, that, params) {
      callback.call(that, params);
      return func.apply(that, params);
    }
  })
}

function createAppEvent(eventName, ...args) {
  return event.trigger('app:' + eventName, ...args);
}

function createPageEvent(eventName, ...args) {
  return event.trigger('page@' + eventName, ...args)
}

/**
 * 创建小程序App对象代理
 */
function proxyApp() {
  App = new Proxy(App, {
    apply(app, thisArg, argArray) {
      return app(APP_PROXY_METHODS.reduce((arg, methodName) => {
        arg[methodName] = createMethodProxy(arg[methodName], function(params) {
          createAppEvent(methodName, ...params)
        });
        return arg;
      }, argArray[0]));
    }
  })
}

/**
 * 创建小程序Page对象代理
 */
function proxyPage() {
  Page = new Proxy(Page, {
    apply(page, thisArg, argArray) {
        argArray[0].events = PAGE_EVENTS_PROXY_METHODS.reduce((evs, methodName) => {
          evs[methodName] =
              createMethodProxy(evs[methodName], function(params) {
                createPageEvent(`${this.route}:${methodName}`, ...params)
              })
          return evs;
        }, argArray[0].events || {});

        return page(PAGE_PROXY_METHODS.reduce((arg, methodName) => {
          arg[methodName] = createMethodProxy(arg[methodName], function(params) {
            createPageEvent(`${this.route}:${methodName}`, ...params)
          })
          return arg;
        }, argArray[0]))
    }
  })
}

/**
 * 监听事件
 * @param scope 'app' | 'pages/index/index' ...
 * @param eventName 'onShow', 'onHide', ....
 * @param callback
 */
export function tap(scope: 'app' | string, eventName: string, callback) {
  if (scope === 'app') {
    event.on('app:' + eventName, callback);
  } else {
    event.on('page@' + scope + ':' + eventName, callback);
  }
}

/**
 * 取消监听
 * @param scope 'app' | 'pages/index/index' ...
 * @param eventName 'onShow', 'onHide', ....
 * @param callback 可选，为空则该事件下的回调全部取消
 */
export function off(scope: 'app' | string, eventName: string, callback?) {
  if (scope === 'app') {
    event.off('app:' + eventName, callback);
  } else {
    event.off('page@' + scope + ':' + eventName, callback);
  }
}

// 防止重复挂载
if (!App.__minitaped) {
  proxyApp();
  proxyPage();
  App.__minitaped = true;
}

export default tap;

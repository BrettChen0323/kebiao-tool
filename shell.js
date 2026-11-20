/* shell.js —— 只在原生外壳（Capacitor）里生效的外壳适配
 *
 * 原型本身画了 iOS 风的假状态栏（.status）。装进 App 之后系统会画真的状态栏，
 * 两个一起出现就是「双状态栏」，所以这里把假的藏掉，并把顶部留白还给内容。
 * 在浏览器里打开原型时这个文件什么也不做。
 */
(function () {
  var cap = window.Capacitor;
  var isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (!isNative) return;

  document.documentElement.classList.add('is-native');

  var css = document.createElement('style');
  css.textContent = [
    /* 系统的状态栏由 OS 画，藏掉原型里那一条 */
    '.is-native .status{display:none!important}',
    /* 少一条状态栏，滚动容器往上补一点，标题不要贴边 */
    '.is-native .view{padding-top:8px}',
    /* WebView 里不需要下拉刷新和橡皮筋 */
    'html,body{overscroll-behavior:none}',
    /* 长按不要弹系统菜单（原型里没有可复制的正文） */
    '.is-native .phone{-webkit-touch-callout:none}'
  ].join('\n');
  document.head.appendChild(css);

  /* Android 上把配色告诉系统栏，避免黑白错位 */
  var theme = document.querySelector('meta[name="theme-color"]');
  if (!theme) {
    theme = document.createElement('meta');
    theme.name = 'theme-color';
    document.head.appendChild(theme);
  }
  theme.content = '#090B10';
})();

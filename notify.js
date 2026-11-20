/* notify.js —— 把课表和待办变成系统的本地通知
 *
 * 和原型的关系：完全只读。原型把数据放在 localStorage['kcb.v1'] 里
 * （{ courses, todos, txs }），这里只负责读出来、翻译成通知排程，
 * 再交给 @capacitor/local-notifications 注册到系统。
 *
 * 为什么本地通知能响而网页不能：网页在后台会被浏览器冻结定时器；
 * 本地通知是交给系统的 AlarmManager / UNUserNotificationCenter 排程的，
 * 关掉 App、锁屏、重启手机都还在。
 */
(function () {
  var KEY = 'kcb.v1';

  /* 和原型 05a-core.js 里的 PERIODS 保持一致：start/end 是当天第几分钟 */
  var PERIODS = [
    { n: '1-2', start: 8 * 60, end: 9 * 60 + 35 },
    { n: '3-4', start: 9 * 60 + 55, end: 11 * 60 + 30 },
    { n: '5-6', start: 13 * 60 + 30, end: 15 * 60 + 5 },
    { n: '7-8', start: 15 * 60 + 25, end: 17 * 60 },
    { n: '9-10', start: 18 * 60 + 30, end: 20 * 60 + 5 }
  ];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(min) { return pad2(Math.floor(min / 60) % 24) + ':' + pad2(min % 60); }

  /* Capacitor / iOS 的 weekday：1 = 周日 … 7 = 周六；原型里 1 = 周一 … 7 = 周日 */
  function capWeekday(day) { return (day % 7) + 1; }

  function readStore() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /* 纯函数：给一份数据，算出应该注册哪些通知（浏览器里也能单独测） */
  function buildPlan(store) {
    var courses = (store && store.courses) || [];
    var todos = (store && store.todos) || [];
    var plan = [];
    var id = 1001;
    var now = Date.now();

    courses.forEach(function (c) {
      var p = PERIODS[c.p] || PERIODS[0];
      var remind = typeof c.remind === 'number' ? c.remind : 15;
      var at = p.start - remind;
      while (at < 0) at += 24 * 60;              /* 早八提前量跨到前一天，绕回来 */
      plan.push({
        id: id++,
        title: c.name + ' · ' + remind + ' 分钟后上课',
        body: [p.n + ' 节 ' + hhmm(p.start), c.room].filter(Boolean).join(' · '),
        schedule: {
          on: { weekday: capWeekday(c.day), hour: Math.floor(at / 60), minute: at % 60, second: 0 },
          repeats: true,
          allowWhileIdle: true
        },
        extra: { kind: 'course', cid: c.id }
      });
    });

    todos.forEach(function (t) {
      if (t.done) return;
      var due = new Date(t.due);
      if (isNaN(due.getTime()) || due.getTime() <= now) return;   /* 过期的就不再补一条 */
      plan.push({
        id: id++,
        title: t.text,
        body: ['待办到点', t.tag].filter(Boolean).join(' · '),
        schedule: { at: due, allowWhileIdle: true },
        extra: { kind: 'todo', tid: t.id }
      });
    });

    return plan;
  }

  function plugin() {
    var cap = window.Capacitor;
    return (cap && cap.Plugins && cap.Plugins.LocalNotifications) || null;
  }

  function tell(msg) {
    if (typeof window.toast === 'function') window.toast(msg);
    else console.log('[notify]', msg);
  }

  var syncing = false;

  function sync(quiet) {
    var LN = plugin();
    if (!LN) { if (!quiet) console.log('[notify] 不在原生外壳里，跳过'); return; }
    if (syncing) return;
    syncing = true;

    Promise.resolve()
      .then(function () { return LN.checkPermissions(); })
      .then(function (perm) {
        if (perm.display === 'granted') return perm;
        return LN.requestPermissions();
      })
      .then(function (perm) {
        if (perm.display !== 'granted') {
          if (!quiet) tell('通知权限没开 · 到手机设置里允许通知才会响');
          throw new Error('PERMISSION');
        }
        var store = readStore();
        var plan = buildPlan(store);
        var hasData = !!(store && ((store.courses || []).length || (store.todos || []).length));
        /* 首次启动时原型还没写进 localStorage，这时候什么都别提，等它写完自己会再排一次 */
        if (!hasData) { throw new Error('NO_DATA'); }
        /* 先清空上一次排的，避免改课表后旧提醒还在响 */
        return LN.getPending()
          .then(function (p) {
            var ids = (p.notifications || []).map(function (n) { return { id: n.id }; });
            return ids.length ? LN.cancel({ notifications: ids }) : null;
          })
          .then(function () {
            if (!plan.length) return null;
            return LN.schedule({ notifications: plan });
          })
          .then(function () {
            if (!quiet) {
              var c = plan.filter(function (x) { return x.schedule.repeats; }).length;
              var t = plan.length - c;
              tell('已排程 ' + c + ' 节课' + (t ? ' + ' + t + ' 条待办' : '') + '提醒');
            }
            console.log('[notify] scheduled', plan.length, plan);
          });
      })
      .catch(function (err) {
        if (!/PERMISSION|NO_DATA/.test(String(err && err.message))) console.warn('[notify] 失败', err);
      })
      .then(function () { syncing = false; });
  }

  /* 老师改一次数据就重排一次：saveState 是原型里的全局函数，包一层 */
  var pendingTimer = null;
  function soon() {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () { sync(true); }, 1200);
  }

  function boot() {
    if (!plugin()) return;
    if (typeof window.saveState === 'function' && !window.saveState.__kcbWrapped) {
      var orig = window.saveState;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        soon();
        return r;
      };
      wrapped.__kcbWrapped = true;
      window.saveState = wrapped;
    }
    sync(false);
  }

  window.kcbSyncNotifications = function () { sync(false); };
  window.__kcbBuildPlan = buildPlan;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 从后台切回来补一次：跨天、跨周之后排程要跟上 */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && plugin()) soon();
  });
})();

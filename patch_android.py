"""在 `npx cap add android` 之后，把这份工程需要的东西补进生成的 Android 项目。

CI 里由 .github/workflows/android.yml 调用；本机装了 Node 也可以手动跑：

    npx cap add android
    python tools/patch_android.py

做三件事：
  1. 加权限（精确定时 / 开机恢复 / 通知 / 震动）—— 少了它们提醒在 Android 12+ 上会被推迟
  2. 换启动图标（用 resources/ 里的，五种密度）
  3. 换通知栏小图标
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AND = os.path.join(ROOT, 'android')
RES = os.path.join(AND, 'app', 'src', 'main', 'res')
MANIFEST = os.path.join(AND, 'app', 'src', 'main', 'AndroidManifest.xml')
ASSETS = os.path.join(ROOT, 'resources')

PERMS = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
    'android.permission.WAKE_LOCK',
]

DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
LAUNCHER = [48, 72, 96, 144, 192]
FOREGROUND = [108, 162, 216, 324, 432]
STAT = [24, 36, 48, 72, 96]


def fail(msg):
    print('✗', msg)
    sys.exit(1)


def patch_manifest():
    if not os.path.exists(MANIFEST):
        fail('找不到 AndroidManifest.xml，先跑 npx cap add android')
    xml = open(MANIFEST, encoding='utf-8').read()
    missing = [p for p in PERMS if f'android:name="{p}"' not in xml]
    if missing:
        block = '\n'.join(f'    <uses-permission android:name="{p}" />' for p in missing)
        # 插在 <application 之前
        xml = re.sub(r'(\n(\s*)<application)', f'\n{block}\\1', xml, count=1)
        open(MANIFEST, 'w', encoding='utf-8').write(xml)
    print(f'✓ manifest 权限：新增 {len(missing)} 条，已有 {len(PERMS) - len(missing)} 条')


def copy_icons(pattern_pairs, folder):
    for dens, size in zip(DENSITIES, [48, 72, 96, 144, 192]):
        target_dir = os.path.join(RES, f'{folder}-{dens}')
        if not os.path.isdir(target_dir):
            continue
        for name, sizes in pattern_pairs:
            src = os.path.join(ASSETS, f'{name}-{sizes[DENSITIES.index(dens)]}.png')
            if not os.path.exists(src):
                continue
            dst = os.path.join(target_dir, f'{name}.png')
            open(dst, 'wb').write(open(src, 'rb').read())
    print(f'✓ {folder} 图标已替换')


def main():
    patch_manifest()

    # 启动图标：mipmap-*/ic_launcher.png / ic_launcher_round.png / ic_launcher_foreground.png
    for dens, (lz, fz) in zip(DENSITIES, zip(LAUNCHER, FOREGROUND)):
        d = os.path.join(RES, f'mipmap-{dens}')
        if not os.path.isdir(d):
            continue
        for name, size in (('ic_launcher', lz), ('ic_launcher_round', lz), ('ic_launcher_foreground', fz)):
            src = os.path.join(ASSETS, f'icon-{size}.png' if name != 'ic_launcher_foreground'
                               else f'ic_launcher_foreground-{size}.png')
            if os.path.exists(src):
                open(os.path.join(d, f'{name}.png'), 'wb').write(open(src, 'rb').read())
    print('✓ mipmap 启动图标已替换')

    # 通知栏小图标：drawable-*/ic_stat_icon.png
    for dens, sz in zip(DENSITIES, STAT):
        d = os.path.join(RES, f'drawable-{dens}')
        os.makedirs(d, exist_ok=True)
        src = os.path.join(ASSETS, f'ic_stat_icon-{sz}.png')
        if os.path.exists(src):
            open(os.path.join(d, 'ic_stat_icon.png'), 'wb').write(open(src, 'rb').read())
    print('✓ drawable 通知图标已写入')

    # 顺手把电池优化提示常见的 targetSdk 检查打出来，方便排查
    gradle = os.path.join(AND, 'app', 'build.gradle')
    if os.path.exists(gradle):
        m = re.search(r'targetSdkVersion\s+(\d+)', open(gradle, encoding='utf-8').read())
        if m:
            print(f'· targetSdk = {m.group(1)}（Android 13+ 首次启动会弹通知权限）')

    print('完成。接下来：cd android && ./gradlew assembleDebug')


if __name__ == '__main__':
    main()

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // E: 드라이브가 FAT32라 webpack의 심볼릭 링크 확인(readlink)이
    // 일반 파일에서도 EISDIR을 반환해 빌드가 깨지는 문제 회피
    config.resolve.symlinks = false;

    if (dev) {
      // 같은 FAT32 원인으로 webpack의 영속 파일시스템 캐시가 node_modules를
      // 스냅샷(mtime/stat 비교)하다가 "Unable to snapshot resolve dependencies"
      // 경고를 반복 출력함(치명적이진 않고, 해당 캐시 팩만 버려지고 다시 계산됨).
      // FAT32는 mtime 해상도가 2초로 낮아 이 스냅샷 비교가 자주 어긋나는 것으로 보임 —
      // dev 모드에서는 파일시스템 캐시 대신 메모리 캐시를 써서 이 스냅샷 시도 자체를
      // 없앤다. 서버를 껐다 켜면 캐시가 사라져 첫 컴파일은 느리지만, 같은 세션
      // 안에서는 HMR 속도에 차이가 없다.
      config.cache = { type: "memory" };
    }

    return config;
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // E: 드라이브가 FAT32라 webpack의 심볼릭 링크 확인(readlink)이
    // 일반 파일에서도 EISDIR을 반환해 빌드가 깨지는 문제 회피
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;

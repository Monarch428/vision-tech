// src/metrics.ts
import os from "os";

export function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startCpus = os.cpus();
    setTimeout(() => {
      const endCpus = os.cpus();
      let idleDifference = 0;
      let totalDifference = 0;
      for (let index = 0; index < startCpus.length; index++) {
        const startTimes = startCpus[index].times;
        const endTimes = endCpus[index].times;
        idleDifference += endTimes.idle - startTimes.idle;
        totalDifference +=
          (endTimes.user + endTimes.nice + endTimes.sys + endTimes.idle + endTimes.irq) -
          (startTimes.user + startTimes.nice + startTimes.sys + startTimes.idle + startTimes.irq);
      }
      const usage = totalDifference === 0 ? 0 : 100 - (idleDifference / totalDifference) * 100;
      resolve(Math.round(usage));
    }, 500);
  });
}

export function getMemoryUsage(): number {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  return Math.round(((totalMemory - freeMemory) / totalMemory) * 100);
}
import checkDiskSpace from "check-disk-space";

export async function getStorageUsage(): Promise<number> {
  try {
    // Windows needs a drive letter path (e.g. "C:/"); Linux/macOS use root "/"
    const targetPath = os.platform() === "win32" ? "C:/" : "/";
    const { free, size } = await checkDiskSpace(targetPath);
    const used = size - free;
    return Math.round((used / size) * 100);
  } catch (err) {
    console.error("Failed to read disk space:", err);
    return 0; // fall back safely rather than crashing the heartbeat loop
  }
}

export function calculateHealth(cpu: number, memory: number, storage: number): number {
  const averageUsage = (cpu + memory + storage) / 3;
  return Math.max(0, Math.round(100 - averageUsage));
}
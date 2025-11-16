import { useQuery } from "@tanstack/react-query";
import { fetchFileKey } from "../services/fileKeyService";

/**
 * 使用 React Query 获取单个 fileKey 的数据
 * 自动处理缓存、重复请求去重
 */
export function useFileKey(fileKey: string | null | undefined) {
  return useQuery({
    queryKey: ["fileKey", fileKey],
    queryFn: () => {
      if (!fileKey) {
        throw new Error("fileKey is required");
      }
      return fetchFileKey(fileKey);
    },
    enabled: Boolean(fileKey), // 只有当 fileKey 存在时才执行查询
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}



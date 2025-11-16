import { useQuery } from "@tanstack/react-query";
import { fetchAllFileKeys } from "../services/fileKeyService";

/**
 * 使用 React Query 获取所有 fileKeys
 * 自动处理缓存
 */
export function useAllFileKeys() {
  return useQuery({
    queryKey: ["fileKeys", "all"],
    queryFn: fetchAllFileKeys,
    staleTime: 2 * 60 * 1000, // 2分钟缓存
  });
}



import { useInfiniteQuery } from "@tanstack/react-query";
import {
  fetchFileKeysByCursor,
  type FileKeysCursor,
} from "../services/fileKeyService";

const PAGE_SIZE = 5; // 每页5条数据

/**
 * 使用 React Query 的无限查询来实现分页加载
 * 自动处理缓存和下一页数据获取
 */
export function useInfiniteFileKeys() {
  return useInfiniteQuery({
    queryKey: ["fileKeys", "infinite"],
    queryFn: ({ pageParam }) => {
      return fetchFileKeysByCursor(
        (pageParam as FileKeysCursor | undefined) ?? null,
        PAGE_SIZE
      );
    },
    getNextPageParam: (lastPage) => {
      // 如果这一页数量少于 PAGE_SIZE，说明已经没有更多数据
      if (!lastPage.data || lastPage.data.length < PAGE_SIZE) {
        return undefined;
      }
      // 使用服务端返回的下一页光标
      return lastPage.cursor ?? undefined;
    },
    initialPageParam: null as FileKeysCursor | null,
    staleTime: 2 * 60 * 1000, // 2分钟缓存
  });
}

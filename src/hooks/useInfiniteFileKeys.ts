import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFileKeysPaginated } from "../services/fileKeyService";

const PAGE_SIZE = 5; // 每页5条数据

/**
 * 使用 React Query 的无限查询来实现分页加载
 * 自动处理缓存和下一页数据获取
 */
export function useInfiniteFileKeys() {
  return useInfiniteQuery({
    queryKey: ["fileKeys", "infinite"],
    queryFn: ({ pageParam = 1 }) => {
      return fetchFileKeysPaginated(pageParam, PAGE_SIZE);
    },
    getNextPageParam: (lastPage, allPages) => {
      // 计算已加载的总数据量
      const loadedCount = allPages.reduce((sum, page) => sum + page.data.length, 0);
      
      // 如果已加载数量小于总数，返回下一页页码
      if (loadedCount < lastPage.total) {
        return allPages.length + 1;
      }
      
      // 否则返回 undefined，表示没有更多数据
      return undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2分钟缓存
  });
}


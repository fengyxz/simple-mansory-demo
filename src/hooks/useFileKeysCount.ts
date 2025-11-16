import { useQuery } from "@tanstack/react-query";
import { fetchFileKeysTotalCount } from "../services/fileKeyService";

export function useFileKeysCount() {
  return useQuery({
    queryKey: ["fileKeys", "totalCount"],
    queryFn: fetchFileKeysTotalCount,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}



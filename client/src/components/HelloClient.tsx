import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGreeting } from "@/hooks/use-greeting";
import { toast } from "@/hooks/use-toast";

export function HelloClient() {
  const { data, isLoading, error, refetch, isFetching } = useGreeting();

  const status = isLoading ? "loading" : error ? "error" : "ready";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>GET /api/greeting</CardTitle>
            <CardDescription>响应会被 Zod 校验，并展示到 UI 中。</CardDescription>
          </div>
          <Badge variant={status === "error" ? "destructive" : "secondary"}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "请求失败"}
            </p>
          ) : (
            <p className="text-lg leading-7">“{data?.message}”</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "刷新中…" : "刷新"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              toast({
                title: "Toast 正常工作",
                description: "如果你能看到我，说明 shadcn/toast 已接入。",
              })
            }
          >
            触发 Toast
          </Button>
        </div>

        <EnvHint />
      </CardContent>
    </Card>
  );
}

function EnvHint() {
  return (
    <div className="text-sm text-muted-foreground">
      <p>
        默认使用 <code>DB_TYPE=sqlite</code> 和 <code>./.data/app.db</code>，服务启动时会自动同步示例表。若要切到 Postgres，可在 <code>.env.local</code> 设置 <code>DB_TYPE=postgres</code> 和 <code>DATABASE_URL</code>；数据库类型建议在首次启动前确定。
      </p>
    </div>
  );
}

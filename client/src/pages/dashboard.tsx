import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Settings, type Message, type GlobalStats } from "@shared/schema";
import { RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Link } from "wouter";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: settings } = useQuery<Settings>({ 
    queryKey: ["/api/settings"]
  });

  const { data: messages, refetch: refetchMessages } = useQuery<Message[]>({ 
    queryKey: ["/api/messages", { limit: 5 }]
  });

  const { data: globalStats } = useQuery<GlobalStats>({
    queryKey: ["/api/stats/global"]
  });

  // 日付データをフォーマット
  const formattedDailyData = globalStats?.dailyStats.map(stat => ({
    date: new Date(stat.date).toLocaleDateString(),
    bottles: stat.bottleCount,
    replies: globalStats?.dailyReplies.find(
      reply => new Date(reply.date).toLocaleDateString() === new Date(stat.date).toLocaleDateString()
    )?.replyCount || 0
  }));

  const checkNotifications = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bluesky/check-notifications", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Success",
        description: "Blueskyの通知を確認しました",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 全体の統計情報 */}
        <Card>
          <CardHeader>
            <CardTitle>Global Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Bottles</p>
                <p className="font-medium">{globalStats?.totalBottles || 0}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Total Replies</p>
                <p className="font-medium">{globalStats?.totalReplies || 0}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Active Users (24h)</p>
                <p className="font-medium">{globalStats?.activeUsers || 0}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Active Bottles</p>
                <p className="font-medium">{globalStats?.activeBottles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* プラットフォーム別の統計情報 */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {globalStats?.platformStats.map(stat => (
                <div key={stat.platform} className="space-y-2">
                  <h3 className="font-medium">{stat.platform}</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Active</p>
                      <p className="text-lg font-medium">{stat.mau}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                      <p className="text-lg font-medium">{stat.userCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Bottles</p>
                      <p className="text-lg font-medium">{stat.bottleCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Replies</p>
                      <p className="text-lg font-medium">{stat.replyCount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* アクティビティグラフ */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Activity Trends (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedDailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="bottles"
                    name="Bottles"
                    stroke="#8884d8"
                    activeDot={{ r: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="replies"
                    name="Replies"
                    stroke="#82ca9d"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Bot Status</CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => checkNotifications.mutate()}
              disabled={checkNotifications.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${checkNotifications.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Bluesky Bot</p>
                  <p className="text-sm text-muted-foreground">{settings?.blueskyHandle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={settings?.enabled === 'true' ? 'text-green-500' : 'text-red-500'}>
                    {settings?.enabled === 'true' ? 'Active' : 'Inactive'}
                  </span>
                  <Link href="/responses" className="text-sm text-blue-500 hover:underline">
                    応答設定
                  </Link>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Nostr Bot</p>
                  <p className="text-sm text-muted-foreground">
                    {settings?.nostrPrivateKey ? '設定済み' : '未設定'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={settings?.enabled === 'true' ? 'text-green-500' : 'text-red-500'}>
                    {settings?.enabled === 'true' ? 'Active' : 'Inactive'}
                  </span>
                  <Link href="/responses" className="text-sm text-blue-500 hover:underline">
                    応答設定
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Recent Messages</CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetchMessages()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages?.map(msg => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{msg.sourceUser}</p>
                    <span className={
                      msg.status === 'sent' ? 'text-green-500' :
                      msg.status === 'failed' ? 'text-red-500' :
                      'text-yellow-500'
                    }>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React from "react";
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
import { RefreshCw, Download, Upload, Play, Square, MessageCircle, Wine, Trash2 } from "lucide-react";
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

// ボット起動ボタンコンポーネント
function StartBotButton({ settings }: { settings?: Settings }) {
  const { toast } = useToast();
  
  const startBot = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bots/start", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "ボットを起動しました",
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
    <Button
      variant="outline"
      size="sm"
      onClick={() => startBot.mutate()}
      disabled={startBot.isPending || settings?.botStatus === 'running'}
    >
      <Play className="h-4 w-4 mr-1" />
      起動
    </Button>
  );
}

// ボット停止ボタンコンポーネント
function StopBotButton() {
  const { toast } = useToast();
  
  const stopBot = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bots/stop", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "ボットを停止しました",
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
    <Button
      variant="outline"
      size="sm"
      onClick={() => stopBot.mutate()}
      disabled={stopBot.isPending}
    >
      <Square className="h-4 w-4 mr-1" />
      停止
    </Button>
  );
}

export default function Dashboard() {
  const { toast } = useToast();

  const { data: settings } = useQuery<Settings>({ 
    queryKey: ["/api/settings"]
  });

  const { data: messages, refetch: refetchMessages } = useQuery<Message[]>({ 
    queryKey: ["/api/messages", { limit: 5, includeBottles: true }]
  });

  const updateSettings = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "設定を更新しました",
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

  // Log messages for debugging
  React.useEffect(() => {
    if (messages) {
      console.log('Messages received by dashboard:', JSON.stringify(messages, null, 2));
      console.log('Messages with isBottle:', messages.filter(msg => (msg as any).isBottle));
      console.log('Messages with targetPlatform=bottle:', messages.filter(msg => msg.targetPlatform === 'bottle'));
    }
  }, [messages]);

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

  const exportData = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/data/export");
      const data = await response.json();
      // レスポンスデータを確認
      console.log('Export data:', data);
      console.log('Response type:', typeof data);
      console.log('Has data:', Object.values(data).some(arr => Array.isArray(arr) && arr.length > 0));
      console.log('Data keys:', Object.keys(data));
      console.log('Settings length:', data.settings?.length);
      console.log('Bottles length:', data.bottles?.length);

      // ダウンロードファイルを作成
      const jsonData = JSON.stringify(data, null, 2);
      console.log('JSON data length:', jsonData.length);
      console.log('First 200 chars of JSON:', jsonData.substring(0, 200));

      const blob = new Blob([jsonData], { type: 'application/json' });
      console.log('Blob size:', blob.size);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bottlemail-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "データのエクスポートが完了しました",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "データのエクスポートに失敗しました",
        variant: "destructive",
      });
    },
  });

  const importData = useMutation({
    mutationFn: async (file: File) => {
      const data = await file.text();
      await apiRequest("POST", "/api/data/import", JSON.parse(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: "Success",
        description: "データのインポートが完了しました",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "データのインポートに失敗しました",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importData.mutate(file);
    }
  };

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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => checkNotifications.mutate()}
                disabled={checkNotifications.isPending}
                title="通知を手動で確認"
              >
                <RefreshCw className={`h-4 w-4 ${checkNotifications.isPending ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Bluesky Bot</p>
                  <p className="text-sm text-muted-foreground">{settings?.blueskyHandle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={
                    settings?.botStatus === 'running' ? 'text-green-500' : 
                    settings?.botStatus === 'error' ? 'text-red-500' : 
                    'text-yellow-500'
                  }>
                    {settings?.botStatus === 'running' ? '実行中' : 
                     settings?.botStatus === 'error' ? 'エラー' : 
                     '停止中'}
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
                  <span className={
                    settings?.botStatus === 'running' ? 'text-green-500' : 
                    settings?.botStatus === 'error' ? 'text-red-500' : 
                    'text-yellow-500'
                  }>
                    {settings?.botStatus === 'running' ? '実行中' : 
                     settings?.botStatus === 'error' ? 'エラー' : 
                     '停止中'}
                  </span>
                  <Link href="/responses" className="text-sm text-blue-500 hover:underline">
                    応答設定
                  </Link>
                </div>
              </div>
              <div className="flex justify-between mt-4 border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  {settings?.autoStart === 'true' ? '自動起動: 有効' : '自動起動: 無効'}
                  {settings?.blueskyIgnoreBeforeTime && 
                    ` / ${new Date(settings.blueskyIgnoreBeforeTime).toLocaleString()} 以前のDMは無視`}
                </div>
                <div className="flex gap-2">
                  <StartBotButton settings={settings} />
                  <StopBotButton />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 自動投稿設定 */}
        <Card>
          <CardHeader>
            <CardTitle>自動投稿設定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Bluesky自動投稿設定 */}
              <div className="space-y-2">
                <h3 className="font-medium">Bluesky</h3>
                <div className="flex items-center justify-between border p-3 rounded-md">
                  <div>
                    <p className="font-medium">タイムライン自動投稿</p>
                    <p className="text-sm text-muted-foreground">
                      {settings?.blueskyAutoPostEnabled === 'true' ? '有効' : '無効'}
                      {settings?.blueskyAutoPostEnabled === 'true' && 
                        ` / ${settings?.blueskyAutoPostInterval || 10}分ごと`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">間隔:</span>
                      <select
                        className="border rounded p-1 text-sm"
                        value={settings?.blueskyAutoPostInterval || 10}
                        onChange={async (e) => {
                          const interval = parseInt(e.target.value);
                          if (settings) {
                            await updateSettings.mutate({
                              ...settings,
                              blueskyAutoPostInterval: interval
                            });
                          }
                        }}
                        disabled={settings?.blueskyAutoPostEnabled !== 'true'}
                      >
                        <option value="5">5分</option>
                        <option value="10">10分</option>
                        <option value="15">15分</option>
                        <option value="30">30分</option>
                        <option value="60">1時間</option>
                      </select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (settings) {
                          await updateSettings.mutate({
                            ...settings,
                            blueskyAutoPostEnabled: settings.blueskyAutoPostEnabled === 'true' ? 'false' : 'true'
                          });
                        }
                      }}
                    >
                      {settings?.blueskyAutoPostEnabled === 'true' ? '無効にする' : '有効にする'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Nostr自動投稿設定 */}
              <div className="space-y-2">
                <h3 className="font-medium">Nostr</h3>
                <div className="flex items-center justify-between border p-3 rounded-md">
                  <div>
                    <p className="font-medium">タイムライン自動投稿</p>
                    <p className="text-sm text-muted-foreground">
                      {settings?.nostrAutoPostEnabled === 'true' ? '有効' : '無効'}
                      {settings?.nostrAutoPostEnabled === 'true' && 
                        ` / ${settings?.nostrAutoPostInterval || 10}分ごと`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">間隔:</span>
                      <select
                        className="border rounded p-1 text-sm"
                        value={settings?.nostrAutoPostInterval || 10}
                        onChange={async (e) => {
                          const interval = parseInt(e.target.value);
                          if (settings) {
                            await updateSettings.mutate({
                              ...settings,
                              nostrAutoPostInterval: interval
                            });
                          }
                        }}
                        disabled={settings?.nostrAutoPostEnabled !== 'true'}
                      >
                        <option value="5">5分</option>
                        <option value="10">10分</option>
                        <option value="15">15分</option>
                        <option value="30">30分</option>
                        <option value="60">1時間</option>
                      </select>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (settings) {
                          await updateSettings.mutate({
                            ...settings,
                            nostrAutoPostEnabled: settings.nostrAutoPostEnabled === 'true' ? 'false' : 'true'
                          });
                        }
                      }}
                    >
                      {settings?.nostrAutoPostEnabled === 'true' ? '無効にする' : '有効にする'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Recent Messages & Bottles</CardTitle>
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
              <div key={msg.id} className="space-y-1 border-b pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(msg as any).isBottle || msg.targetPlatform === 'bottle' ? (
                      <Wine className="h-4 w-4 text-blue-500" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-gray-500" />
                    )}
                    <p className="font-medium">{msg.sourceUser}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={
                      msg.status === 'sent' ? 'text-green-500' :
                      msg.status === 'failed' ? 'text-red-500' :
                      'text-yellow-500'
                    }>
                      {msg.status}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={async () => {
                        try {
                          // ボトルかメッセージかを判断
                          if ((msg as any).isBottle) {
                            // ボトルの場合、IDから1000000を引いて元のボトルIDを取得
                            const bottleId = msg.id - 1000000;
                            await apiRequest("DELETE", `/api/bottles/${bottleId}`);
                          } else {
                            // 通常のメッセージの場合
                            await apiRequest("DELETE", `/api/messages/${msg.id}`);
                          }
                          // 削除成功後、メッセージリストを更新
                          refetchMessages();
                          toast({
                            title: "Success",
                            description: "メッセージを削除しました",
                          });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "メッセージの削除に失敗しました",
                            variant: "destructive",
                          });
                        }
                      }}
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{msg.content}</p>
              </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Import/Export buttons */}
      <Card>
        <CardHeader>
          <CardTitle>データ管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => exportData.mutate()}
              disabled={exportData.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              エクスポート
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="import-file"
                disabled={importData.isPending}
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('import-file')?.click()}
                disabled={importData.isPending}
              >
                <Upload className="mr-2 h-4 w-4" />
                インポート
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

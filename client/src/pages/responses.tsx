import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type BotResponse,
  insertBotResponseSchema,
  responseTypeSchema,
  platformSchema,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// デフォルトのメッセージを定義
const defaultMessages = {
  bluesky: {
    help: `使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。`,
    bottle_sent: "ボトルメールを放流しました！🌊",
    bottle_received: `ボトルメール #{id}

{content}

from {platform}{replies}`,
    reply_sent: "返信を送信しました！",
    reply_notification: `ボトルメール #{id} に返信がありました:

{content}

from {platform}`,
    list: `あなたのボトルメール一覧:
{bottleList}`,
    error: "エラーが発生しました。もう一度お試しください。",
    error_invalid_command: "無効なコマンドです。helpで使用可能なコマンドを確認できます。",
    error_empty_message: "メッセージを入力してください。",
    error_no_bottles: "現在読めるボトルメールはありません。",
    error_missing_id_content: "ボトルメールIDと返信内容を入力してください。",
    error_invalid_id: "無効なボトルメールIDです。",
    error_bottle_not_found: "指定されたボトルメールは存在しません。",
    error_no_reply_permission: "このボトルメールへの返信権限がありません。",
    error_no_bottles_sent: "まだボトルメールを送信していません。",
    error_no_stats: "統計情報がありません。",
    error_message_too_long: "メッセージは140文字以内にしてください。",
    stats: `📊 あなたの統計情報
送信したボトルメール: {sent}通
受信したボトルメール: {received}通
送信した返信: {replies}通
最終アクティビティ: {activity}`,
    auto_post: `📊 Blueskyボットの状態
🌊 ボトル：{activeBottles}通が漂流中、{archivedBottles}通が受け取られました
💬 返信：{totalReplies}通の返信が届いています`
  },
  nostr: {
    help: `使用可能なコマンド:
new [メッセージ] または 流す [メッセージ] - 新しいボトルメールを作成
check または 拾う - 未読のボトルメールを確認
reply [ID] [メッセージ] または 返信 [ID] [メッセージ] - ボトルメールに返信
list または リスト - 送信したボトルメールの一覧
stats - 統計情報を表示
help または ヘルプ - このヘルプを表示

※コマンドの先頭のスラッシュ (/) は省略可能です。`,
    bottle_sent: "ボトルメールを放流しました！🌊",
    bottle_received: `ボトルメール #{id}

{content}

from {platform}{replies}`,
    reply_sent: "返信を送信しました！",
    reply_notification: `ボトルメール #{id} に返信がありました:

{content}

from {platform}`,
    list: `あなたのボトルメール一覧:
{bottleList}`,
    error: "エラーが発生しました。もう一度お試しください。",
    error_invalid_command: "無効なコマンドです。helpで使用可能なコマンドを確認できます。",
    error_empty_message: "メッセージを入力してください。",
    error_no_bottles: "現在読めるボトルメールはありません。",
    error_missing_id_content: "ボトルメールIDと返信内容を入力してください。",
    error_invalid_id: "無効なボトルメールIDです。",
    error_bottle_not_found: "指定されたボトルメールは存在しません。",
    error_no_reply_permission: "このボトルメールへの返信権限がありません。",
    error_no_bottles_sent: "まだボトルメールを送信していません。",
    error_no_stats: "統計情報がありません。",
    error_message_too_long: "メッセージは140文字以内にしてください。",
    stats: `📊 あなたの統計情報
送信したボトルメール: {sent}通
受信したボトルメール: {received}通
送信した返信: {replies}通
最終アクティビティ: {activity}`,
    auto_post: `📊 Nostrボットの状態
🌊 ボトル：{activeBottles}通が漂流中、{archivedBottles}通が受け取られました
💬 返信：{totalReplies}通の返信が届いています`
  }
};

function ResponsesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: responses, isLoading } = useQuery<BotResponse[]>({
    queryKey: ["/api/responses"],
  });

  const form = useForm({
    resolver: zodResolver(insertBotResponseSchema),
    defaultValues: {
      platform: "bluesky",
      responseType: "help",
      message: defaultMessages.bluesky.help,
    },
  });

  // プラットフォームまたはレスポンスタイプが変更されたときにデフォルトメッセージを設定
  const watchPlatform = form.watch("platform");
  const watchResponseType = form.watch("responseType");

  React.useEffect(() => {
    if (watchPlatform && watchResponseType) {
      const platform = watchPlatform as keyof typeof defaultMessages;
      const responseType = watchResponseType as keyof typeof defaultMessages.bluesky;
      
      // 既存の応答を確認
      const existingResponse = responses?.find(
        r => r.platform === platform && r.responseType === responseType
      );
      
      if (existingResponse) {
        // 既存の応答がある場合はそれを使用
        form.setValue("message", existingResponse.message);
      } else {
        // 既存の応答がない場合はデフォルトメッセージを使用
        const defaultMessage = defaultMessages[platform]?.[responseType] || "";
        form.setValue("message", defaultMessage);
      }
    }
  }, [watchPlatform, watchResponseType, responses, form]);

  const saveResponse = useMutation({
    mutationFn: async (data: any) => {
      // 既存の応答を確認
      const existingResponse = responses?.find(
        r => r.platform === data.platform && r.responseType === data.responseType
      );
      
      console.log("Saving response:", {
        data,
        existingResponse,
        isUpdate: !!existingResponse
      });
      
      if (existingResponse) {
        // 既存の応答がある場合は更新
        const response = await apiRequest("PUT", `/api/responses/${existingResponse.id}`, data);
        console.log("Update response:", await response.json());
        return { isUpdate: true };
      } else {
        // 新規作成
        const response = await apiRequest("POST", "/api/responses", data);
        console.log("Create response:", await response.json());
        return { isUpdate: false };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/responses"] });
      
      // プラットフォームとレスポンスタイプの値を保持
      const platform = form.getValues("platform");
      const responseType = form.getValues("responseType");
      
      form.reset({
        platform,
        responseType,
        message: form.getValues("message")
      });
      
      toast({
        title: "Success",
        description: result.isUpdate ? "応答メッセージを更新しました" : "応答メッセージを追加しました",
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

  const deleteResponse = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/responses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/responses"] });
      toast({
        title: "Success",
        description: "応答メッセージを削除しました",
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bot応答メッセージ設定</h1>

      <Card>
        <CardHeader>
          <CardTitle>メッセージの追加・編集</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => saveResponse.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>プラットフォーム</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="プラットフォームを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bluesky">Bluesky</SelectItem>
                        <SelectItem value="nostr">Nostr</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responseType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>応答タイプ</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="応答タイプを選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="help">ヘルプ</SelectItem>
                        <SelectItem value="bottle_sent">ボトル送信完了</SelectItem>
                        <SelectItem value="bottle_received">ボトル受信</SelectItem>
                        <SelectItem value="reply_sent">返信送信完了</SelectItem>
                        <SelectItem value="reply_notification">返信通知</SelectItem>
                        <SelectItem value="list">ボトル一覧</SelectItem>
                        <SelectItem value="error">一般エラー</SelectItem>
                        <SelectItem value="error_invalid_command">無効なコマンド</SelectItem>
                        <SelectItem value="error_empty_message">空のメッセージ</SelectItem>
                        <SelectItem value="error_no_bottles">ボトルなし</SelectItem>
                        <SelectItem value="error_missing_id_content">ID・内容不足</SelectItem>
                        <SelectItem value="error_invalid_id">無効なID</SelectItem>
                        <SelectItem value="error_bottle_not_found">ボトル未発見</SelectItem>
                        <SelectItem value="error_no_reply_permission">返信権限なし</SelectItem>
                        <SelectItem value="error_no_bottles_sent">送信ボトルなし</SelectItem>
                        <SelectItem value="error_no_stats">統計情報なし</SelectItem>
                        <SelectItem value="error_message_too_long">メッセージ長すぎ</SelectItem>
                        <SelectItem value="stats">統計情報</SelectItem>
                        <SelectItem value="auto_post">自動投稿</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メッセージ</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="応答メッセージを入力"
                        className="h-32"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={saveResponse.isPending}
              >
                保存
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登録済みメッセージ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>プラットフォーム</TableHead>
                <TableHead>応答タイプ</TableHead>
                <TableHead>メッセージ</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses?.map((response) => (
                <TableRow key={response.id}>
                  <TableCell>{response.platform}</TableCell>
                  <TableCell>{response.responseType}</TableCell>
                  <TableCell>{response.message}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteResponse.mutate(response.id)}
                      disabled={deleteResponse.isPending}
                    >
                      削除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ResponsesPage;

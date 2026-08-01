// Chat tabi — ekran tanasi src/screens/chat-list.tsx da.
import React from "react";
import { TabSwipe } from "@/components/pv/tab-swipe";
import ChatListScreen from "@/screens/chat-list";

export default function ChatTab() {
  return (
    <TabSwipe tab="/chat">
      <ChatListScreen />
    </TabSwipe>
  );
}

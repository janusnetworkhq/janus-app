import { StyleSheet, View } from "react-native";
import { useMe } from "@/auth/use-me";
import { FeedList } from "@/feed/FeedList";
import { usePlayerStore } from "@/player/player-store";

export default function FeedScreen() {
  const me = useMe();
  const university = usePlayerStore((s) => s.university);
  const isRecruiter = me.data?.role === "RECRUITER";

  return (
    <View style={styles.root}>
      <FeedList
        university={isRecruiter ? university || undefined : undefined}
        isRecruiter={isRecruiter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
});

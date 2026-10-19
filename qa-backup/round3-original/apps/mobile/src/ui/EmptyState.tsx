import { StyleSheet, Text, View } from "react-native";
import { color, font, space } from "../theme";
import { Button } from "./Button";

type Props = {
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ title, body, action }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? <Button label={action.label} onPress={action.onPress} style={styles.btn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space[6],
    gap: space[3],
  },
  title: { color: color.text, fontSize: 22, fontFamily: font.semibold, fontWeight: "600", textAlign: "center" },
  body: { color: color.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  btn: { marginTop: space[3], alignSelf: "stretch" },
});

import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@/ui/theme';

export default function TabLayout() {
  const { c } = useTheme();
  return (
    <NativeTabs tintColor={c.ink}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="dice.fill" md="casino" />
        <NativeTabs.Trigger.Label>Spin</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Icon sf="heart.fill" md="favorite" />
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="clock.fill" md="history" />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme';
import { Loading } from './src/components/UI';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import PaymentsScreen from './src/screens/PaymentsScreen';
import WorkersScreen from './src/screens/WorkersScreen';
import SitesScreen from './src/screens/SitesScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import DispatchesScreen from './src/screens/DispatchesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MORE_SCREENS = [
  { name: 'Attendance', icon: '🗓️' },
  { name: 'Payments', icon: '💰' },
  { name: 'Workers', icon: '👷' },
  { name: 'Sites', icon: '🏗️' },
  { name: 'Reports', icon: '📈' },
];

function TabIcon({ label, color }) {
  const glyph = {
    Dashboard: '📊',
    Dispatch: '🚚',
    Menu: '☰',
  }[label];
  return <Text style={{ fontSize: 18, color }}>{glyph}</Text>;
}

function BottomTabs({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (name) => {
    setMenuOpen(false);
    navigation.navigate(name);
  };
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarIcon: ({ color }) => <TabIcon label={route.name} color={color} />,
          tabBarLabelStyle: { fontSize: 10 },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Dispatch" component={DispatchesScreen} />
        <Tab.Screen
          name="Menu"
          component={DashboardScreen}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setMenuOpen(true);
            },
          }}
        />
        {/* Reachable via the ☰ menu — not shown in the bottom bar */}
        <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Payments" component={PaymentsScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Workers" component={WorkersScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Sites" component={SitesScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarButton: () => null }} />
      </Tab.Navigator>
      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={menuStyles.backdrop} onPress={() => setMenuOpen(false)}>
          {/* Stop taps on the sheet itself from closing the menu */}
          <Pressable style={menuStyles.sheet} onPress={() => {}}>
            <Text style={menuStyles.title}>Menu</Text>
            {MORE_SCREENS.map((s) => (
              <Pressable key={s.name} style={menuStyles.item} onPress={() => go(s.name)}>
                <Text style={menuStyles.icon}>{s.icon}</Text>
                <Text style={menuStyles.label}>{s.name}</Text>
              </Pressable>
            ))}
            <MenuLogout onDone={() => setMenuOpen(false)} />
            <MenuDeleteAccount onDone={() => setMenuOpen(false)} />
            <Pressable style={[menuStyles.item, { marginTop: 8 }]} onPress={() => setMenuOpen(false)}>
              <Text style={menuStyles.icon}>✕</Text>
              <Text style={menuStyles.label}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuLogout({ onDone }) {
  const { logout } = useAuth();
  return (
    <Pressable
      style={menuStyles.item}
      onPress={async () => {
        await logout();
        onDone();
      }}
    >
      <Text style={menuStyles.icon}>🚪</Text>
      <Text style={menuStyles.label}>Log out</Text>
    </Pressable>
  );
}

function MenuDeleteAccount({ onDone }) {
  const { deleteAccount } = useAuth();
  return (
    <Pressable
      style={menuStyles.item}
      onPress={() => {
        Alert.alert(
          'Delete account?',
          'This removes your sites, workers, attendance, payments and dispatches. Cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete everything',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteAccount();
                  onDone();
                } catch (err) {
                  // Staying logged in — AuthContext keeps the session on failure.
                  Alert.alert('Could not delete account', err?.response?.data?.message || err.message || 'Please try again.');
                }
              },
            },
          ]
        );
      }}
    >
      <Text style={menuStyles.icon}>🗑️</Text>
      <Text style={[menuStyles.label, { color: '#b91c1c' }]}>Delete account</Text>
    </Pressable>
  );
}

const menuStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { fontSize: 20, width: 32 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
});

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <Loading label="Starting Karmamitra..." />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={BottomTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
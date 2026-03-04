import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import DriverNavigator from './src/navigation/DriverNavigator';
import SalesNavigator from './src/navigation/SalesNavigator';
import ConsumerNavigator from './src/navigation/ConsumerNavigator';
import { ActivityIndicator, View, StatusBar } from 'react-native';
import { theme } from './src/theme';

const Stack = createStackNavigator();

function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          {user.role === 'DRIVER' && <Stack.Screen name="DriverMain" component={DriverNavigator} />}
          {user.role === 'SALES' && <Stack.Screen name="SalesMain" component={SalesNavigator} />}
          {(user.role === 'MEMBER' || user.role === 'KONSUMEN') && (
            <Stack.Screen name="ConsumerMain" component={ConsumerNavigator} />
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </AuthProvider>
  );
}

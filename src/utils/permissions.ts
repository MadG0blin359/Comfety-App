import { Audio } from 'expo-av';
import { VisionCamera, PermissionStatus } from 'react-native-vision-camera';
import { Linking } from 'react-native';
import { PermissionCheckResult, PermissionsSnapshot, PermissionState } from '../types';

export async function checkMicrophonePermission(): Promise<PermissionCheckResult> {
  try {
    const response = await Audio.getPermissionsAsync();
    let status: PermissionState = 'undetermined';

    if (response.granted) {
      status = 'granted';
    } else if (!response.canAskAgain) {
      status = 'blocked';
    } else if (response.status === 'denied') {
      status = 'denied';
    }

    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
      status,
    };
  } catch (error) {
    console.error('[Permissions] Error checking microphone permission:', error);
    return {
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    };
  }
}

export async function requestMicrophonePermission(): Promise<PermissionCheckResult> {
  try {
    const response = await Audio.requestPermissionsAsync();
    let status: PermissionState = 'undetermined';

    if (response.granted) {
      status = 'granted';
    } else if (!response.canAskAgain) {
      status = 'blocked';
    } else {
      status = 'denied';
    }

    return {
      granted: response.granted,
      canAskAgain: response.canAskAgain,
      status,
    };
  } catch (error) {
    console.error('[Permissions] Error requesting microphone permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }
}

export async function checkCameraPermission(): Promise<PermissionCheckResult> {
  try {
    const statusRaw: PermissionStatus = VisionCamera.cameraPermissionStatus;
    const granted = statusRaw === 'authorized';
    let status: PermissionState = 'undetermined';

    if (granted) {
      status = 'granted';
    } else if (statusRaw === 'denied') {
      status = 'blocked';
    } else if (statusRaw === 'not-determined') {
      status = 'undetermined';
    } else {
      status = 'denied';
    }

    return {
      granted,
      canAskAgain: statusRaw === 'not-determined',
      status,
    };
  } catch (error) {
    console.error('[Permissions] Error checking camera permission:', error);
    return {
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    };
  }
}

export async function requestCameraPermission(): Promise<PermissionCheckResult> {
  try {
    const granted: boolean = await VisionCamera.requestCameraPermission();
    const statusRaw: PermissionStatus = VisionCamera.cameraPermissionStatus;
    let status: PermissionState = 'undetermined';

    if (granted || statusRaw === 'authorized') {
      status = 'granted';
    } else if (statusRaw === 'denied') {
      status = 'blocked';
    } else {
      status = 'denied';
    }

    return {
      granted,
      canAskAgain: statusRaw === 'not-determined',
      status,
    };
  } catch (error) {
    console.error('[Permissions] Error requesting camera permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied',
    };
  }
}

export async function checkPermissionsSnapshot(): Promise<PermissionsSnapshot> {
  const [microphone, camera] = await Promise.all([
    checkMicrophonePermission(),
    checkCameraPermission(),
  ]);

  return { microphone, camera };
}

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.error('[Permissions] Failed to open app settings:', error);
  }
}

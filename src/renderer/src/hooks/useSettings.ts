import store, { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  CustomPrompt,
  SendMessageShortcut,
  setCustomPrompts,
  setSendMessageShortcut as _setSendMessageShortcut,
  setSidebarIcons,
  setTargetLanguage,
  setTheme,
  SettingsState,
  setTopicPosition,
  setTray,
  setWindowStyle
} from '@renderer/store/settings'
import { SidebarIcon, ThemeMode, TranslateLanguageVarious } from '@renderer/types'

export function useSettings() {
  const settings = useAppSelector((state) => state.settings)
  const dispatch = useAppDispatch()

  return {
    ...settings,
    setSendMessageShortcut(shortcut: SendMessageShortcut) {
      dispatch(_setSendMessageShortcut(shortcut))
    },
    setTray(isActive: boolean) {
      dispatch(setTray(isActive))
      window.api.setTray(isActive)
    },
    setTheme(theme: ThemeMode) {
      dispatch(setTheme(theme))
    },
    setWindowStyle(windowStyle: 'transparent' | 'opaque') {
      dispatch(setWindowStyle(windowStyle))
    },
    setTargetLanguage(targetLanguage: TranslateLanguageVarious) {
      dispatch(setTargetLanguage(targetLanguage))
    },
    setTopicPosition(topicPosition: 'left' | 'right') {
      dispatch(setTopicPosition(topicPosition))
    },
    updateSidebarIcons(icons: { visible: SidebarIcon[]; disabled: SidebarIcon[] }) {
      dispatch(setSidebarIcons(icons))
    },
    updateSidebarVisibleIcons(icons: SidebarIcon[]) {
      dispatch(setSidebarIcons({ visible: icons }))
    },
    updateSidebarDisabledIcons(icons: SidebarIcon[]) {
      dispatch(setSidebarIcons({ disabled: icons }))
    },
    setCustomPrompts(customPrompts: CustomPrompt[]) {
      dispatch(setCustomPrompts(customPrompts))
    }
  }
}

export function useMessageStyle() {
  const { messageStyle } = useSettings()
  const isBubbleStyle = messageStyle === 'bubble'

  return {
    isBubbleStyle
  }
}

export const getStoreSetting = (key: keyof SettingsState) => {
  return store.getState().settings[key]
}

import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { CustomPrompt } from '@renderer/types'

export interface PromptsState {
  customPrompts: CustomPrompt[]
}

const initialState: PromptsState = {
  customPrompts: []
}

const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    setCustomPrompts: (state, action: PayloadAction<CustomPrompt[]>) => {
      state.customPrompts = action.payload
    },
    addCustomPrompt: (state, action: PayloadAction<CustomPrompt>) => {
      state.customPrompts.push(action.payload)
    },
    removeCustomPrompt: (state, action: PayloadAction<string>) => {
      state.customPrompts = state.customPrompts.filter((prompt) => prompt.id !== action.payload)
    },
    updateCustomPrompt: (state, action: PayloadAction<CustomPrompt>) => {
      const index = state.customPrompts.findIndex((prompt) => prompt.id === action.payload.id)
      if (index !== -1) {
        state.customPrompts[index] = action.payload
      }
    }
  }
})

export const { setCustomPrompts, addCustomPrompt, removeCustomPrompt, updateCustomPrompt } = promptsSlice.actions
export default promptsSlice.reducer

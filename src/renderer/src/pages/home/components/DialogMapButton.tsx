import { getTopicById } from '@renderer/hooks/useTopic'
import { RootState } from '@renderer/store'
import { selectCurrentTopicId } from '@renderer/store/messages'
import { Topic } from '@renderer/types'
import { Drawer, Tooltip } from 'antd'
import { GitBranch } from 'lucide-react'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import DialogMapComponent from '../Messages/DialogMap'

const DialogMapButton: FC = () => {
  const { t } = useTranslation()
  const [isDialogMapOpen, setIsDialogMapOpen] = useState(false)
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null)
  const currentTopicId = useSelector((state: RootState) => selectCurrentTopicId(state))

  // 获取当前Topic
  useEffect(() => {
    if (currentTopicId && isDialogMapOpen) {
      getTopicById(currentTopicId).then((topic) => {
        setCurrentTopic(topic)
      })
    }
  }, [currentTopicId, isDialogMapOpen])

  // 打开对话地图
  const openDialogMap = () => {
    setIsDialogMapOpen(true)
  }

  // 关闭对话地图
  const closeDialogMap = () => {
    setIsDialogMapOpen(false)
  }

  return (
    <>
      <Tooltip title={t('dialogMap.title')} mouseEnterDelay={0.8}>
        <DialogMapIcon onClick={openDialogMap}>
          <GitBranch size={18} />
        </DialogMapIcon>
      </Tooltip>

      <Drawer
        title={t('dialogMap.title')}
        placement="right"
        onClose={closeDialogMap}
        open={isDialogMapOpen}
        width={800}
        destroyOnClose
        styles={{
          body: {
            padding: 0,
            height: 'calc(100% - 55px)'
          }
        }}>
        {currentTopic && <DialogMapComponent topic={currentTopic} onClose={closeDialogMap} />}
      </Drawer>
    </>
  )
}

const NavbarIcon = styled.div`
  -webkit-app-region: none;
  border-radius: 8px;
  height: 30px;
  padding: 0 7px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  .iconfont {
    font-size: 18px;
    color: var(--color-icon);
  }
  .anticon {
    color: var(--color-icon);
    font-size: 16px;
  }
  &:hover {
    background-color: var(--color-background-mute);
    color: var(--color-icon-white);
  }
`

const DialogMapIcon = styled(NavbarIcon)`
  @media (max-width: 1000px) {
    display: none;
  }
`

export default DialogMapButton

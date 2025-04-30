import '@xyflow/react/dist/style.css'

import {
  ArrowRightOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons'
import { getModelLogo } from '@renderer/config/models'
import { useTheme } from '@renderer/context/ThemeProvider'
import db from '@renderer/databases'
import DialogMapService from '@renderer/services/DialogMapService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { useAppDispatch } from '@renderer/store'
import { updateMessages } from '@renderer/store/messages'
import type { DialogMap as DialogMapType, Topic } from '@renderer/types'
import { buildDialogMapFlowData } from '@renderer/utils/dialogMapUtils'
import { BezierEdge, Controls, Handle, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { EdgeTypes, NodeTypes, Position, useEdgesState, useNodesState } from '@xyflow/react'
import { Avatar, Button, Dropdown, Empty, Modal, Spin, Tooltip } from 'antd'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 自定义节点组件
const DialogMapNode: FC<{ data: any }> = ({ data }) => {
  const { t } = useTranslation()
  const nodeType = data.type
  let borderColor = '#d9d9d9' // 默认边框颜色
  let title = ''
  let backgroundColor = '#ffffff' // 默认背景色
  let gradientColor = 'rgba(0, 0, 0, 0.03)' // 默认渐变色
  const isSelected = data.isSelected
  const [showAddBranchArrow, setShowAddBranchArrow] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(data.isCollapsed)

  // 当外部折叠状态变化时更新内部状态
  useEffect(() => {
    setIsCollapsed(data.isCollapsed)
  }, [data.isCollapsed])

  // 判断是否为合并的用户-模型对卡片
  const isCombined = !!data.userContent
  const userContent = data.userContent
  const hasChildren = data.childrenCount > 0

  // 根据节点类型和合并状态设置样式
  if (isCombined) {
    // 合并模式 - 用户和助手在同一个卡片
    borderColor = isSelected ? 'var(--color-primary)' : 'var(--color-black-mute)'
    backgroundColor = isSelected ? 'var(--color-primary-mute)' : 'var(--color-black-soft)'
    gradientColor = isSelected ? 'var(--color-primary-soft)' : 'var(--color-black-mute-soft)'
    title = `${data.model || t('dialogMap.unknown_model')}`
  } else if (nodeType === 'user') {
    // 单独的用户节点
    borderColor = isSelected ? 'var(--color-primary)' : 'var(--color-link)' // 用户节点颜色
    backgroundColor = isSelected ? 'var(--color-primary-mute)' : 'var(--color-link-soft)'
    gradientColor = isSelected ? 'var(--color-primary-soft)' : 'var(--color-link-mute)'
    title = t('chat.history.user_node')
  } else if (nodeType === 'assistant') {
    // 单独的助手节点
    borderColor = isSelected ? 'var(--color-primary)' : 'var(--color-black-mute)' // 助手节点颜色
    backgroundColor = isSelected ? 'var(--color-primary-mute)' : 'var(--color-black-soft)'
    gradientColor = isSelected ? 'var(--color-primary-soft)' : 'var(--color-black-mute-soft)'
    title = `${data.model || t('dialogMap.unknown_model')}`
  }

  // 处理节点点击事件，选择节点路径
  const handleNodeClick = () => {
    if (data.onNodeClick && data.nodeId) {
      data.onNodeClick(data.nodeId)
    }
  }

  // 处理添加分支按钮点击
  const handleAddBranch = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onAddBranch && data.nodeId) {
      data.onAddBranch(data.nodeId)
    }
  }

  // 处理鼠标悬停在加号按钮上
  const handleAddBranchHover = (isHovering: boolean) => {
    setShowAddBranchArrow(isHovering)
  }

  // 处理折叠/展开点击
  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newIsCollapsed = !isCollapsed
    setIsCollapsed(newIsCollapsed)
    if (data.onToggleCollapse) {
      data.onToggleCollapse(data.nodeId, newIsCollapsed)
    }
  }

  // 右键菜单项
  const contextMenuItems = [
    {
      key: 'navigate',
      label: t('dialogMap.navigate_to_node'),
      icon: <ArrowRightOutlined />,
      onClick: () => {
        if (data.onNavigateToNode && data.nodeId) {
          data.onNavigateToNode(data.nodeId)
        }
      }
    },
    {
      key: 'delete',
      label: t('dialogMap.delete_node'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        if (data.onDeleteNode && data.nodeId) {
          Modal.confirm({
            title: t('dialogMap.delete_node_confirm_title'),
            content: t('dialogMap.delete_node_confirm_content'),
            okText: t('common.delete'),
            cancelText: t('common.cancel'),
            okButtonProps: { danger: true },
            onOk: () => {
              data.onDeleteNode(data.nodeId)
            }
          })
        }
      }
    }
  ]

  // 隐藏连接点的通用样式
  const handleStyle = {
    opacity: 0,
    width: '12px',
    height: '12px',
    background: 'transparent',
    border: 'none'
  }

  const tooltipTitle = (
    <TooltipContent>
      <TooltipTitle>{title}</TooltipTitle>
      {isCombined ? (
        <>
          <TooltipBody>
            <strong>{t('chat.history.user_node')}:</strong> {userContent}
            <hr style={{ margin: '8px 0', borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            <strong>{title}:</strong> {data.content}
          </TooltipBody>
        </>
      ) : (
        <TooltipBody>{data.content}</TooltipBody>
      )}
      <TooltipFooter>{t('dialogMap.click_to_select')}</TooltipFooter>
    </TooltipContent>
  )

  return (
    <Tooltip
      title={tooltipTitle}
      placement="top"
      color="rgba(0, 0, 0, 0.85)"
      mouseEnterDelay={0.2}
      mouseLeaveDelay={0.1}
      destroyTooltipOnHide>
      <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
        <NodeWrapper>
          {/* 只在助手/组合节点显示添加分支按钮 */}
          {(nodeType === 'assistant' || isCombined) && (
            <AddBranchButtonContainer
              onMouseEnter={() => handleAddBranchHover(true)}
              onMouseLeave={() => handleAddBranchHover(false)}>
              <Tooltip title={t('dialogMap.create_branch')} placement="top">
                <AddBranchButtonOutside onClick={handleAddBranch}>
                  <PlusOutlined />
                </AddBranchButtonOutside>
              </Tooltip>
              {showAddBranchArrow && <BranchArrow />}
            </AddBranchButtonContainer>
          )}

          {/* 添加折叠按钮 */}
          {hasChildren && (
            <Tooltip title={isCollapsed ? t('dialogMap.expand_nodes') : t('dialogMap.collapse_nodes')} placement="top">
              <CollapseButton onClick={handleCollapseClick} $isCollapsed={isCollapsed}>
                {isCollapsed ? data.childrenCount : <MinusOutlined />}
              </CollapseButton>
            </Tooltip>
          )}

          <CustomNodeContainer
            style={{
              borderColor,
              background: `linear-gradient(135deg, ${backgroundColor} 0%, ${gradientColor} 100%)`,
              boxShadow: `0 4px 10px rgba(0, 0, 0, 0.1), 0 0 0 2px ${borderColor}40`,
              height: isCombined ? '160px' : '100px' // 调整合并模式下的高度
            }}
            onClick={handleNodeClick}
            $isSelected={isSelected}
            $borderColor={borderColor}>
            <Handle type="target" position={Position.Top} style={handleStyle} isConnectable={false} />
            <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
            <Handle type="target" position={Position.Right} style={handleStyle} isConnectable={false} />
            <Handle type="target" position={Position.Bottom} style={handleStyle} isConnectable={false} />

            {isCombined ? (
              <>
                {/* 合并模式UI - 同时显示用户提问和模型回答，使用统一样式 */}
                <CombinedNodeContent>
                  <UserContentSection>
                    <CompactMessageRow>
                      <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--color-link)' }} size={22} />
                      <CompactContent className="user-content">{userContent}</CompactContent>
                    </CompactMessageRow>
                  </UserContentSection>

                  <Divider style={{ margin: '4px 0' }} />

                  <ModelSection>
                    <CompactMessageRow>
                      <Avatar
                        src={data.modelInfo ? getModelLogo(data.modelId) : undefined}
                        icon={!data.modelInfo ? <RobotOutlined /> : undefined}
                        style={{ backgroundColor: 'var(--color-black-mute)' }}
                        size={22}
                      />
                      <CompactContent>{data.content}</CompactContent>
                    </CompactMessageRow>
                  </ModelSection>
                </CombinedNodeContent>
              </>
            ) : (
              <>
                {/* 单节点模式UI */}
                <CompactMessageRow>
                  {nodeType === 'user' ? (
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--color-link)' }} size={22} />
                  ) : (
                    <Avatar
                      src={data.modelInfo ? getModelLogo(data.modelId) : undefined}
                      icon={!data.modelInfo ? <RobotOutlined /> : undefined}
                      style={{ backgroundColor: 'var(--color-black-mute)' }}
                      size={22}
                    />
                  )}
                  <CompactContent>{data.content}</CompactContent>
                </CompactMessageRow>
              </>
            )}

            <Handle type="source" position={Position.Bottom} style={handleStyle} isConnectable={false} />
            <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />
            <Handle type="source" position={Position.Left} style={handleStyle} isConnectable={false} />
            <Handle type="source" position={Position.Top} style={handleStyle} isConnectable={false} />
          </CustomNodeContainer>
        </NodeWrapper>
      </Dropdown>
    </Tooltip>
  )
}

// 创建自定义节点类型
const nodeTypes: NodeTypes = { dialogMapNode: DialogMapNode }

// 添加边缘类型
const edgeTypes: EdgeTypes = { bezier: BezierEdge }

interface DialogMapProps {
  topic: Topic
  onClose: () => void
}

// 统一的边配置
const defaultEdgeOptions = {
  animated: true,
  type: 'bezier',
  zIndex: 5
}

interface CollapsedNodesState {
  [topicId: string]: string[]
}

// 主对话地图组件
const DialogMap: FC<DialogMapProps> = ({ topic, onClose }) => {
  const { t } = useTranslation()
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([])
  const [loading, setLoading] = useState(true)
  const [dialogMap, setDialogMap] = useState<DialogMapType | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set())
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const dialogMapRef = useRef<DialogMapType | null>(null)

  useEffect(() => {
    dialogMapRef.current = dialogMap
  }, [dialogMap])

  // 加载对话地图数据
  const loadDialogMap = useCallback(async () => {
    if (!topic) return

    setLoading(true)
    try {
      // 获取主题的最新消息
      const currentTopic = await db.topics.get(topic.id)
      if (!currentTopic) {
        throw new Error(`Topic with id ${topic.id} not found`)
      }

      // 获取所有消息ID作为新的路径
      const newPath = currentTopic.messages.map((msg) => msg.id)

      // 获取或创建对话地图
      let map = await DialogMapService.createDialogMapFromTopic(topic.id)

      // 更新对话地图，合并新的路径
      map = await DialogMapService.updateDialogMap(topic.id, newPath)

      // 获取当前选中的路径
      const currentSelectedPath = map.selectedPath || []

      // 确保根节点是用户的第一个提问
      const rootNode = Object.values(map.nodes).find((node) => !node.parentId)

      if (rootNode && rootNode.role !== 'user') {
        // 如果不是用户消息，找到第一个用户消息作为根节点
        const firstUserNode = Object.values(map.nodes).find((node) => node.role === 'user')

        if (firstUserNode) {
          // 更新根节点关系
          map.rootNodeId = firstUserNode.id
          firstUserNode.parentId = null
          // 更新其他节点的父节点关系
          Object.values(map.nodes).forEach((node) => {
            if (node.id !== firstUserNode.id && node.parentId === rootNode.id) {
              node.parentId = firstUserNode.id
              firstUserNode.children.push(node.id)
            }
          })
          // 删除原来的根节点
          delete map.nodes[rootNode.id]
        }
      } else if (rootNode) {
        // 确保 rootNodeId 与实际根节点一致
        map.rootNodeId = rootNode.id
      }

      // 更新节点的选中状态，只选中当前路径上的节点
      Object.values(map.nodes).forEach((node) => {
        node.isSelected = currentSelectedPath.includes(node.id)
      })

      setDialogMap(map)
      setSelectedNodeIds(currentSelectedPath)
    } catch (error) {
      console.error('Failed to load dialog map:', error)
    } finally {
      setLoading(false)
    }
  }, [topic])

  // 监听消息更新事件
  useEffect(() => {
    const unsubscribe = EventEmitter.on(EVENT_NAMES.MESSAGES_UPDATED, async (data: { topicId: string }) => {
      if (data.topicId === topic.id) {
        // 重新加载对话地图
        await loadDialogMap()
      }
    })

    return () => unsubscribe()
  }, [topic.id, loadDialogMap])

  // 每次打开地图时重新加载数据
  useEffect(() => {
    if (topic) {
      loadDialogMap()
    }
  }, [topic, loadDialogMap])

  // 处理节点折叠/展开
  const handleToggleCollapse = useCallback((nodeId: string, isCollapsed: boolean) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev)
      if (isCollapsed) {
        newSet.add(nodeId)
      } else {
        newSet.delete(nodeId)
      }
      return newSet
    })
  }, [])

  // 加载保存的折叠状态
  useEffect(() => {
    const loadCollapsedState = async () => {
      try {
        const savedState = (await db.settings.where('id').equals('dialogMapCollapsedNodes').first()) as
          | { value: CollapsedNodesState }
          | undefined
        if (savedState?.value && savedState.value[topic.id]) {
          setCollapsedNodes(new Set(savedState.value[topic.id]))
        } else {
          // 如果没有保存的状态，重置为空集合
          setCollapsedNodes(new Set())
        }
      } catch (error) {
        console.error('Failed to load collapsed state:', error)
        // 发生错误时也重置为空集合
        setCollapsedNodes(new Set())
      }
    }
    // 每次加载对话地图时都重新加载折叠状态
    if (!loading && dialogMap) {
      loadCollapsedState()
    }
  }, [topic.id, loading, dialogMap])

  // 保存折叠状态
  useEffect(() => {
    const saveCollapsedState = async () => {
      try {
        const savedState = (await db.settings.where('id').equals('dialogMapCollapsedNodes').first()) as
          | { value: CollapsedNodesState }
          | undefined
        const newState = {
          id: 'dialogMapCollapsedNodes',
          value: {
            ...(savedState?.value || {}),
            [topic.id]: Array.from(collapsedNodes)
          }
        }
        await db.settings.put(newState)
      } catch (error) {
        console.error('Failed to save collapsed state:', error)
      }
    }
    // 只有在对话地图加载完成后才保存折叠状态
    if (!loading && dialogMap && collapsedNodes.size > 0) {
      saveCollapsedState()
    }
  }, [collapsedNodes, topic.id, loading, dialogMap])

  // 处理节点点击，更新选择的路径
  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!dialogMap) return

      try {
        // 使用工具函数构建完整路径
        const fullPath = await DialogMapService.getNodeFullPath(dialogMap.id, nodeId)

        // 更新服务层中的选中路径
        const updatedMap = await DialogMapService.setSelectedPath(dialogMap.id, fullPath)

        // 更新本地状态
        setSelectedNodeIds(fullPath)
        setDialogMap(updatedMap)
      } catch (error) {
        console.error('Failed to handle node click:', error)
      }
    },
    [dialogMap]
  )

  // 添加处理新分支的函数
  const handleAddBranch = useCallback(
    async (nodeId: string) => {
      if (!dialogMap) return

      try {
        // 使用服务层方法处理分支创建
        const ancestors = await DialogMapService.notifyBranchCreation(dialogMap.id, nodeId)

        // 根据选中的路径生成消息列表
        const messages = await DialogMapService.generateMessagesFromPath(dialogMap, ancestors)

        // 更新当前对话的消息
        dispatch(updateMessages(topic, messages))

        // 发送事件通知消息已更新
        EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })

        // 关闭对话地图窗口
        onClose()
      } catch (error) {
        console.error('Failed to handle add branch:', error)
      }
    },
    [dialogMap, topic, dispatch, onClose]
  )

  // 处理删除节点
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!dialogMap) return

      try {
        // 调用服务删除节点及其子节点
        const updatedMap = await DialogMapService.deleteNodeAndDescendants(dialogMap.id, nodeId)

        // 更新状态
        setDialogMap(updatedMap)
        setSelectedNodeIds(updatedMap.selectedPath)

        // 如果删除后选择了新的路径，则更新对话
        if (updatedMap.selectedPath && updatedMap.selectedPath.length > 0) {
          // 根据选中的路径生成消息列表
          const messages = await DialogMapService.generateMessagesFromPath(updatedMap, updatedMap.selectedPath)

          // 更新当前对话的消息
          dispatch(updateMessages(topic, messages))

          // 发送事件通知消息已更新
          EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })
        }
      } catch (error) {
        console.error('Failed to delete node:', error)
        Modal.error({
          title: t('dialogMap.delete_node_error'),
          content: String(error)
        })
      }
    },
    [dialogMap, topic, dispatch, t]
  )

  // 处理跳转到节点的功能
  const handleNavigateToNode = useCallback(
    async (nodeId: string) => {
      if (!dialogMap || !topic) return

      try {
        // 获取节点
        const node = dialogMap.nodes[nodeId]
        if (!node || !node.messageId) return

        // 检查节点是否在当前选中的path中
        const isInSelectedPath = node.isSelected

        // 如果不在当前选中的path中，先切换path
        if (!isInSelectedPath) {
          // 使用工具函数获取完整路径
          const fullPath = await DialogMapService.getNodeFullPath(dialogMap.id, nodeId)

          // 处理路径变更并生成新消息
          const messages = await DialogMapService.processPathChangeAndGenerateMessages(dialogMap.id, fullPath)

          // 更新当前对话的消息
          dispatch(updateMessages(topic, messages))

          // 发送事件通知消息已更新
          EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })
        }

        // 发送LOCATE_MESSAGE事件，定位到消息
        EventEmitter.emit(EVENT_NAMES.LOCATE_MESSAGE + ':' + node.messageId)

        // 关闭对话地图
        onClose()
      } catch (error) {
        console.error('Failed to navigate to node:', error)
      }
    },
    [dialogMap, topic, dispatch, onClose]
  )

  // 当对话地图数据变化时，更新流程图
  useEffect(() => {
    if (!loading && dialogMap) {
      const flowData = buildDialogMapFlowData(
        dialogMap,
        t,
        handleNodeClick,
        handleAddBranch,
        handleDeleteNode,
        handleNavigateToNode,
        collapsedNodes,
        handleToggleCollapse
      )
      setNodes(flowData.nodes)
      setEdges(flowData.edges)
    }
  }, [
    loading,
    dialogMap,
    t,
    handleNodeClick,
    handleAddBranch,
    handleDeleteNode,
    handleNavigateToNode,
    collapsedNodes,
    handleToggleCollapse,
    setNodes,
    setEdges
  ])

  // 应用选中的路径生成新的对话
  const applySelectedPath = useCallback(async () => {
    if (!dialogMap || !topic) return

    try {
      // 查找并应用最佳路径
      const updatedMap = await DialogMapService.findAndApplyOptimalPath(dialogMap.id, selectedNodeIds)

      // 根据完整的路径生成消息列表
      const messages = await DialogMapService.generateMessagesFromPath(updatedMap, updatedMap.selectedPath)

      // 更新当前对话的消息
      dispatch(updateMessages(topic, messages))

      // 发送事件通知消息已更新
      EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })

      // 关闭对话地图
      onClose()
    } catch (error) {
      console.error('Failed to apply selected path:', error)
    }
  }, [dialogMap, selectedNodeIds, topic, dispatch, onClose])

  return (
    <FlowContainer>
      <ActionButtons>
        <Button type="primary" onClick={applySelectedPath} disabled={!dialogMap || selectedNodeIds.length === 0}>
          {t('dialogMap.apply_selected_path')}
        </Button>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </ActionButtons>

      {loading ? (
        <LoadingContainer>
          <Spin size="large" />
        </LoadingContainer>
      ) : dialogMap && nodes.length > 0 ? (
        <ReactFlowProvider>
          <div style={{ width: '100%', height: 'calc(100% - 50px)' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={true}
              zoomOnDoubleClick={true}
              preventScrolling={true}
              elementsSelectable={true}
              selectNodesOnDrag={false}
              nodesFocusable={true}
              zoomOnScroll={true}
              panOnScroll={true}
              minZoom={0.4}
              maxZoom={2}
              defaultEdgeOptions={defaultEdgeOptions}
              fitView={true}
              fitViewOptions={{
                padding: 0.4,
                includeHiddenNodes: false,
                minZoom: 0.3,
                maxZoom: 2
              }}
              proOptions={{ hideAttribution: true }}
              className="react-flow-container"
              colorMode={theme === 'auto' ? 'system' : theme}>
              <Controls showInteractive={false} />
              <MiniMap
                nodeStrokeWidth={3}
                zoomable
                pannable
                nodeColor={(node) => {
                  if (node.data.isSelected) return 'var(--color-primary)'
                  return node.data.type === 'user' ? 'var(--color-link)' : 'var(--color-black-mute)'
                }}
              />
            </ReactFlow>
          </div>
        </ReactFlowProvider>
      ) : (
        <EmptyContainer>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<EmptyText>{t('dialogMap.no_conversation')}</EmptyText>}
          />
        </EmptyContainer>
      )}
    </FlowContainer>
  )
}

// 样式组件定义
const FlowContainer = styled.div`
  width: 100%;
  height: 100%;
  min-height: 500px;
  position: relative;
`

const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  min-height: 500px;
  display: flex;
  justify-content: center;
  align-items: center;
`

const EmptyContainer = styled.div`
  width: 100%;
  height: 100%;
  min-height: 500px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--color-text-secondary);
`

const EmptyText = styled.div`
  font-size: 16px;
  margin-bottom: 8px;
  font-weight: bold;
`

const ActionButtons = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  gap: 8px;
`

interface CustomNodeContainerProps {
  $isSelected: boolean
  $borderColor: string
}

const CustomNodeContainer = styled.div<CustomNodeContainerProps>`
  padding: 12px;
  border-radius: 10px;
  border: 2px solid;
  width: 240px;
  height: 100px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  ${(props) =>
    props.$isSelected &&
    `
    box-shadow: 0 0 0 3px var(--color-primary-soft) !important;
    transform: scale(1.02);
  `}

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 6px 10px var(--color-border-soft),
      0 0 0 2px ${(props) => props.$borderColor || 'var(--color-border)'}40 !important;
    filter: brightness(1.02);
  }

  /* 添加点击动画效果 */
  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 4px var(--color-border-soft);
    transition: all 0.1s ease;
  }
`

// 定义提示框样式组件
const TooltipContent = styled.div`
  max-width: 300px;
`

const TooltipTitle = styled.div`
  font-weight: bold;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
`

const TooltipBody = styled.div`
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 8px;
  white-space: pre-wrap;
`

const TooltipFooter = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
`

// 添加新的样式组件
const CombinedNodeContent = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`

const UserContentSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
`

const ModelSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
`

const CompactMessageRow = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 4px;
  gap: 8px;
`

const CompactContent = styled.div`
  flex: 1;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: ${(props) => (props.className === 'user-content' ? '2' : '3')};
  -webkit-box-orient: vertical;
  line-height: 1.5;
  word-break: break-word;
  font-size: 15px;
  position: relative;
`

const AddBranchButtonContainer = styled.div`
  position: absolute;
  top: 50%;
  right: -40px;
  transform: translateY(-50%);
  z-index: 10;
`

const AddBranchButtonOutside = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 12px;
  background-color: var(--color-primary);
  color: white;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.1);
    background-color: var(--color-primary-dark);
  }

  &:active {
    transform: scale(0.95);
  }
`

const BranchArrow = styled.div`
  position: absolute;
  top: 50%;
  right: 24px;
  width: 20px;
  height: 0;
  border-top: 2px dashed var(--color-primary);
  transform: translateY(-50%);

  &:before {
    content: '';
    position: absolute;
    right: 0;
    top: -4px;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 3px 0 3px 6px;
    border-color: transparent transparent transparent var(--color-primary);
  }
`

const Divider = styled.hr`
  border: none;
  border-top: 1px dashed rgba(0, 0, 0, 0.15);
  margin: 4px 0;
  width: 100%;
`

const NodeWrapper = styled.div`
  position: relative;
  width: 240px;
  height: 160px;
  display: flex;
  justify-content: center;
  align-items: center;
`

const CollapseButton = styled.div<{ $isCollapsed: boolean }>`
  position: absolute;
  top: calc(50% + 40px);
  right: -40px;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 12px;
  background-color: var(--color-bg-1);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  font-size: ${(props) => (props.$isCollapsed ? '12px' : '14px')};
  color: var(--color-text);
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-bg-2);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }
`

export default DialogMap

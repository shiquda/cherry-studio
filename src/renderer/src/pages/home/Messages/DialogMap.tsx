import '@xyflow/react/dist/style.css'

import { ArrowRightOutlined, DeleteOutlined, PlusOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import { getModelLogo } from '@renderer/config/models'
import { useTheme } from '@renderer/context/ThemeProvider'
import db from '@renderer/databases'
import DialogMapService from '@renderer/services/DialogMapService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { useAppDispatch } from '@renderer/store'
import { updateMessages } from '@renderer/store/messages'
import type { DialogMap as DialogMapType, DialogMapNode as DialogMapNodeType, Topic } from '@renderer/types'
import { Controls, Handle, MiniMap, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { Edge, MarkerType, Node, NodeTypes, Position, useEdgesState, useNodesState } from '@xyflow/react'
import { Avatar, Button, Dropdown, Empty, Modal, Spin, Tooltip } from 'antd'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 定义Tooltip相关样式组件
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

// 自定义节点组件
const DialogMapNode: FC<{ data: any }> = ({ data }) => {
  const { t } = useTranslation()
  const nodeType = data.type
  let borderColor = '#d9d9d9' // 默认边框颜色
  let title = ''
  let backgroundColor = '#ffffff' // 默认背景色
  let gradientColor = 'rgba(0, 0, 0, 0.03)' // 默认渐变色
  let avatar: React.ReactNode | null = null
  const isSelected = data.isSelected

  // 根据消息类型设置不同的样式和图标
  if (nodeType === 'user') {
    borderColor = isSelected ? 'var(--color-primary)' : 'var(--color-link)' // 用户节点颜色
    backgroundColor = isSelected ? 'var(--color-primary-mute)' : 'var(--color-link-soft)'
    gradientColor = isSelected ? 'var(--color-primary-soft)' : 'var(--color-link-mute)'
    title = data.userName || t('chat.history.user_node')

    // 用户头像
    if (data.userAvatar) {
      avatar = <Avatar src={data.userAvatar} alt={title} />
    } else {
      avatar = <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'var(--color-link)' }} />
    }
  } else if (nodeType === 'assistant') {
    borderColor = isSelected ? 'var(--color-primary)' : 'var(--color-black-mute)' // 助手节点颜色
    backgroundColor = isSelected ? 'var(--color-primary-mute)' : 'var(--color-black-soft)'
    gradientColor = isSelected ? 'var(--color-primary-soft)' : 'var(--color-black-mute-soft)'
    title = `${data.model || t('dialogMap.unknown_model')}`

    // 模型头像
    if (data.modelInfo) {
      avatar = <ModelAvatar model={data.modelInfo} size={32} />
    } else if (data.modelId) {
      const modelLogo = getModelLogo(data.modelId)
      avatar = (
        <Avatar
          src={modelLogo}
          icon={!modelLogo ? <RobotOutlined /> : undefined}
          style={{ backgroundColor: 'var(--color-black-mute)' }}
        />
      )
    } else {
      avatar = <Avatar icon={<RobotOutlined />} style={{ backgroundColor: 'var(--color-black-mute)' }} />
    }
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

  return (
    <Tooltip
      title={
        <TooltipContent>
          <TooltipTitle>{title}</TooltipTitle>
          <TooltipBody>{data.content}</TooltipBody>
          <TooltipFooter>{t('dialogMap.click_to_select')}</TooltipFooter>
        </TooltipContent>
      }
      placement="top"
      color="rgba(0, 0, 0, 0.85)"
      mouseEnterDelay={0.3}
      mouseLeaveDelay={0.1}
      destroyTooltipOnHide>
      <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
        <CustomNodeContainer
          style={{
            borderColor,
            background: `linear-gradient(135deg, ${backgroundColor} 0%, ${gradientColor} 100%)`,
            boxShadow: `0 4px 10px rgba(0, 0, 0, 0.1), 0 0 0 2px ${borderColor}40`
          }}
          onClick={handleNodeClick}
          $isSelected={isSelected}>
          <Handle type="target" position={Position.Top} style={handleStyle} isConnectable={false} />
          <Handle type="target" position={Position.Left} style={handleStyle} isConnectable={false} />
          <Handle type="target" position={Position.Right} style={handleStyle} isConnectable={false} />
          <Handle type="target" position={Position.Bottom} style={handleStyle} isConnectable={false} />

          <NodeHeader>
            <NodeAvatar>{avatar}</NodeAvatar>
            <NodeTitle>{title}</NodeTitle>
            {nodeType === 'assistant' && (
              <AddBranchButton onClick={handleAddBranch}>
                <PlusOutlined />
              </AddBranchButton>
            )}
          </NodeHeader>
          <NodeContent title={data.content}>{data.content}</NodeContent>

          <Handle type="source" position={Position.Bottom} style={handleStyle} isConnectable={false} />
          <Handle type="source" position={Position.Right} style={handleStyle} isConnectable={false} />
          <Handle type="source" position={Position.Left} style={handleStyle} isConnectable={false} />
          <Handle type="source" position={Position.Top} style={handleStyle} isConnectable={false} />
        </CustomNodeContainer>
      </Dropdown>
    </Tooltip>
  )
}

// 创建自定义节点类型
const nodeTypes: NodeTypes = { dialogMapNode: DialogMapNode }

interface DialogMapProps {
  topic: Topic
  onClose: () => void
}

// 统一的边样式
const commonEdgeStyle = {
  stroke: 'var(--color-border-dark, #666)',
  strokeWidth: 3,
  strokeDasharray: '5,3',
  transition: '0.3s ease-in-out'
}

// 选中路径的边样式
const selectedEdgeStyle = {
  stroke: 'var(--color-primary)',
  strokeWidth: 4,
  strokeDasharray: 'none',
  transition: '0.3s ease-in-out'
}

// 统一的边配置
const defaultEdgeOptions = {
  animated: true,
  style: commonEdgeStyle,
  type: 'bezier',
  zIndex: 5
}

// 主对话地图组件
const DialogMap: FC<DialogMapProps> = ({ topic, onClose }) => {
  const { t } = useTranslation()
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([])
  const [loading, setLoading] = useState(true)
  const [dialogMap, setDialogMap] = useState<DialogMapType | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const dialogMapRef = useRef<DialogMapType | null>(null)

  useEffect(() => {
    dialogMapRef.current = dialogMap
  }, [dialogMap])

  // 监听消息更新事件
  useEffect(() => {
    const unsubscribe = EventEmitter.on(EVENT_NAMES.MESSAGES_UPDATED, async (data: { topicId: string }) => {
      if (data.topicId === topic.id) {
        // 重新加载对话地图
        await loadDialogMap()
      }
    })

    return () => unsubscribe()
  }, [topic.id])

  // 每次打开地图时重新加载数据
  useEffect(() => {
    if (topic) {
      loadDialogMap()
    }
  }, [topic])

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

  // 处理节点点击，更新选择的路径
  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!dialogMap) return

      // 查找节点的祖先路径
      const findAncestors = (id: string, result: string[] = []): string[] => {
        const node = dialogMap.nodes[id]
        if (!node) return result

        result.unshift(id)

        if (node.parentId && dialogMap.nodes[node.parentId]) {
          return findAncestors(node.parentId, result)
        }

        return result
      }

      // 查找节点的子孙路径（深度优先）
      const findDescendants = (id: string, result: string[] = []): string[] => {
        const node = dialogMap.nodes[id]
        if (!node) return result

        if (!result.includes(id)) {
          result.push(id)
        }

        if (node.children.length === 0) return result

        // 只跟随第一个子节点的路径
        return findDescendants(node.children[0], result)
      }

      // 构建完整路径：祖先 + 当前节点 + 第一个子路径
      const ancestors = findAncestors(nodeId)
      const fullPath = [...ancestors]

      // 当前节点不是叶子节点时，添加第一个子路径
      const currentNode = dialogMap.nodes[nodeId]
      if (currentNode && currentNode.children.length > 0) {
        // 去掉已经添加的当前节点
        const descendants = findDescendants(currentNode.children[0])
        fullPath.push(...descendants)
      }

      // 更新选中状态
      const updatedNodes = { ...dialogMap.nodes }
      Object.keys(updatedNodes).forEach((id) => {
        updatedNodes[id].isSelected = fullPath.includes(id)
      })

      // 更新状态
      setSelectedNodeIds(fullPath)
      setDialogMap({
        ...dialogMap,
        nodes: updatedNodes,
        selectedPath: fullPath
      })

      // 保存选择的路径
      await DialogMapService.setSelectedPath(dialogMap.id, fullPath)
    },
    [dialogMap]
  )

  // 添加处理新分支的函数
  const handleAddBranch = useCallback(
    async (nodeId: string) => {
      if (!dialogMap) return

      // 查找节点的祖先路径
      const findAncestors = (id: string, result: string[] = []): string[] => {
        const node = dialogMap.nodes[id]
        if (!node) return result

        result.unshift(id)

        if (node.parentId && dialogMap.nodes[node.parentId]) {
          return findAncestors(node.parentId, result)
        }

        return result
      }

      // 获取到当前节点的路径
      const ancestors = findAncestors(nodeId)

      // 更新节点的选中状态
      const updatedNodes = { ...dialogMap.nodes }
      Object.keys(updatedNodes).forEach((id) => {
        updatedNodes[id].isSelected = ancestors.includes(id)
      })

      // 更新状态
      setSelectedNodeIds(ancestors)
      setDialogMap({
        ...dialogMap,
        nodes: updatedNodes,
        selectedPath: ancestors
      })

      // 保存选择的路径
      await DialogMapService.setSelectedPath(dialogMap.id, ancestors)

      // 根据选中的路径生成消息列表
      const messages = await DialogMapService.generateMessagesFromPath(dialogMap, ancestors)

      // 更新当前对话的消息
      dispatch(updateMessages(topic, messages))

      // 发送事件通知消息已更新
      EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })

      // 关闭对话地图窗口
      onClose()
    },
    [dialogMap, topic, dispatch, onClose]
  )

  // 应用选中的路径生成新的对话
  const applySelectedPath = useCallback(async () => {
    if (!dialogMap || !topic) return

    // 查找选中路径中的所有节点
    const findPathNodes = (nodeIds: string[]): string[] => {
      const result: string[] = []
      const visited = new Set<string>()

      // 首先找到所有选中的节点
      const selectedNodes = nodeIds.map((id) => dialogMap.nodes[id]).filter(Boolean)

      // 找到最深的选中节点（即离根节点最远的节点）
      const findDeepestNode = (nodes: DialogMapNodeType[]): DialogMapNodeType => {
        let deepestNode = nodes[0]
        let maxDepth = 0

        const calculateDepth = (nodeId: string, depth: number = 0): number => {
          const node = dialogMap.nodes[nodeId]
          if (!node || !node.parentId) return depth
          return calculateDepth(node.parentId, depth + 1)
        }

        nodes.forEach((node) => {
          const depth = calculateDepth(node.id)
          if (depth > maxDepth) {
            maxDepth = depth
            deepestNode = node
          }
        })

        return deepestNode
      }

      // 从最深的节点开始，构建完整路径
      const deepestNode = findDeepestNode(selectedNodes)
      let currentNode: DialogMapNodeType | null = deepestNode

      // 从最深节点向上遍历到根节点
      while (currentNode) {
        if (!visited.has(currentNode.id)) {
          result.unshift(currentNode.id)
          visited.add(currentNode.id)
        }
        currentNode = currentNode.parentId ? dialogMap.nodes[currentNode.parentId] : null
      }

      // 从最深节点向下遍历到叶子节点
      currentNode = deepestNode
      while (currentNode && currentNode.children.length > 0) {
        const nextNode = dialogMap.nodes[currentNode.children[0]]
        if (!nextNode) break
        if (!visited.has(nextNode.id)) {
          result.push(nextNode.id)
          visited.add(nextNode.id)
        }
        currentNode = nextNode
      }

      return result
    }

    // 获取完整的路径
    const fullPath = findPathNodes(selectedNodeIds)

    // 根据完整的路径生成消息列表
    const messages = await DialogMapService.generateMessagesFromPath(dialogMap, fullPath)

    // 更新当前对话的消息
    dispatch(updateMessages(topic, messages))

    // 发送事件通知消息已更新
    EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })

    // 关闭对话地图
    onClose()
  }, [dialogMap, selectedNodeIds, topic, dispatch, onClose])

  // 处理跳转到节点的功能
  const handleNavigateToNode = useCallback(
    async (nodeId: string) => {
      if (!dialogMap || !topic) return

      // 获取节点
      const node = dialogMap.nodes[nodeId]
      if (!node || !node.messageId) return

      // 检查节点是否在当前选中的path中
      const isInSelectedPath = node.isSelected

      // 如果不在当前选中的path中，先切换path
      if (!isInSelectedPath) {
        // 查找节点的祖先路径
        const findAncestors = (id: string, result: string[] = []): string[] => {
          const node = dialogMap.nodes[id]
          if (!node) return result

          result.unshift(id)

          if (node.parentId && dialogMap.nodes[node.parentId]) {
            return findAncestors(node.parentId, result)
          }

          return result
        }

        // 查找节点的子孙路径（深度优先）
        const findDescendants = (id: string, result: string[] = []): string[] => {
          const node = dialogMap.nodes[id]
          if (!node) return result

          if (!result.includes(id)) {
            result.push(id)
          }

          if (node.children.length === 0) return result

          // 只跟随第一个子节点的路径
          return findDescendants(node.children[0], result)
        }

        // 构建完整路径：祖先 + 当前节点 + 第一个子路径
        const ancestors = findAncestors(nodeId)
        const fullPath = [...ancestors]

        // 当前节点不是叶子节点时，添加第一个子路径
        if (node.children.length > 0) {
          // 去掉已经添加的当前节点
          const descendants = findDescendants(node.children[0])
          fullPath.push(...descendants)
        }

        // 更新选中状态
        const updatedNodes = { ...dialogMap.nodes }
        Object.keys(updatedNodes).forEach((id) => {
          updatedNodes[id].isSelected = fullPath.includes(id)
        })

        // 更新状态
        setSelectedNodeIds(fullPath)
        setDialogMap({
          ...dialogMap,
          nodes: updatedNodes,
          selectedPath: fullPath
        })

        // 保存选择的路径
        await DialogMapService.setSelectedPath(dialogMap.id, fullPath)

        // 根据选中的路径生成消息列表
        const messages = await DialogMapService.generateMessagesFromPath(dialogMap, fullPath)

        // 更新当前对话的消息
        dispatch(updateMessages(topic, messages))

        // 发送事件通知消息已更新
        EventEmitter.emit(EVENT_NAMES.MESSAGES_UPDATED, { topicId: topic.id })
      }

      // 发送LOCATE_MESSAGE事件，定位到消息
      EventEmitter.emit(EVENT_NAMES.LOCATE_MESSAGE + ':' + node.messageId)

      // 关闭对话地图
      onClose()
    },
    [dialogMap, topic, dispatch, setSelectedNodeIds, setDialogMap, onClose]
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

  // 构建对话地图数据结构
  const buildDialogMapFlowData = useCallback(() => {
    if (!dialogMap) return { nodes: [], edges: [] }

    // 创建节点和边
    const flowNodes: Node[] = []
    const flowEdges: Edge[] = []

    // 节点布局参数 - 垂直布局
    const verticalGap = 220 // 增加垂直间距
    const horizontalGap = 360 // 水平间距
    const initialX = 400 // 初始X位置（居中）
    const initialY = 100 // 初始Y位置
    const maxNodesPerLevel = 4 // 每层最大节点数
    const alternatingOffset = 0.8 // 控制子节点交替偏移的程度

    // 节点尺寸参数（用于碰撞检测）
    const NODE_WIDTH = 240 // 节点宽度
    const NODE_MARGIN = 40 // 节点之间的最小间距

    // 先计算每个节点的层级（深度）
    const nodeLevels: Record<string, number> = {}

    // 计算节点的层级（从根节点到叶子节点）
    const calculateNodeLevels = (nodes: Record<string, DialogMapNodeType>) => {
      // 首先找到没有父节点的节点（根节点）
      const rootNodes = Object.values(nodes).filter((node) => !node.parentId)

      // 从根节点开始，为每个节点分配层级
      const assignLevel = (nodeId: string, level: number) => {
        nodeLevels[nodeId] = level
        const node = nodes[nodeId]
        if (node && node.children.length > 0) {
          node.children.forEach((childId) => {
            assignLevel(childId, level + 1)
          })
        }
      }

      rootNodes.forEach((node) => {
        assignLevel(node.id, 0)
      })
    }

    calculateNodeLevels(dialogMap.nodes)

    // 按层级对节点进行分组
    const nodesByLevel: Record<number, string[]> = {}
    Object.entries(nodeLevels).forEach(([nodeId, level]) => {
      if (!nodesByLevel[level]) {
        nodesByLevel[level] = []
      }
      nodesByLevel[level].push(nodeId)
    })

    // 计算节点的X坐标，使同一层级的节点水平排列，但主要分支保持在中央
    const nodePositions: Record<string, { x: number; y: number }> = {}

    // 第一遍：按照树形结构分配初始位置
    // 逐层计算节点位置，从上到下
    Object.keys(nodesByLevel)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((levelStr) => {
        const level = parseInt(levelStr, 10)
        const nodesInLevel = nodesByLevel[level]

        // 计算本层的Y坐标
        const yPos = initialY + level * verticalGap

        // 处理本层的每个节点
        nodesInLevel.forEach((nodeId, index) => {
          const node = dialogMap.nodes[nodeId]

          // 如果是根节点或第一级，居中排列
          if (level === 0) {
            nodePositions[nodeId] = { x: initialX, y: yPos }
            return
          }

          // 找到父节点并获取其位置
          if (!node.parentId || !nodePositions[node.parentId]) {
            // 没有父节点的位置信息，按索引计算位置
            const xPos = initialX + (index - nodesInLevel.length / 2) * horizontalGap
            nodePositions[nodeId] = { x: xPos, y: yPos }
            return
          }

          // 获取父节点的X坐标
          const parentX = nodePositions[node.parentId].x

          // 获取该节点是父节点的第几个子节点
          const siblingIndex = dialogMap.nodes[node.parentId].children.indexOf(nodeId)
          const siblingCount = dialogMap.nodes[node.parentId].children.length

          // 改进的X位置计算，使子节点更好地围绕父节点分布
          let xOffset = 0
          if (siblingCount > 1) {
            // 为子节点创建更均匀的左右分布
            // 偶数索引的子节点放在右侧，奇数索引的子节点放在左侧
            const direction = siblingIndex % 2 === 0 ? 1 : -1 // 决定子节点在父节点的左侧还是右侧
            const magnitude = Math.floor((siblingIndex + 1) / 2) // 计算偏移量的大小
            const minOffset = NODE_WIDTH + NODE_MARGIN // 最小偏移确保不重叠

            // 计算实际X偏移
            xOffset = direction * magnitude * minOffset * alternatingOffset

            // 如果子节点数量为奇数，确保第一个节点位置居中
            if (siblingCount % 2 === 1 && siblingIndex === 0) {
              xOffset = 0
            }
          }

          // 确保节点不会超出可视区域
          const maxX = initialX + (maxNodesPerLevel * (NODE_WIDTH + NODE_MARGIN)) / 2
          const minX = initialX - (maxNodesPerLevel * (NODE_WIDTH + NODE_MARGIN)) / 2
          const xPos = Math.min(Math.max(parentX + xOffset, minX), maxX)

          nodePositions[nodeId] = {
            x: xPos,
            y: yPos
          }
        })
      })

    // 第二遍：检测并解决节点重叠问题
    // 逐层调整节点位置
    Object.keys(nodesByLevel)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((levelStr) => {
        const level = parseInt(levelStr, 10)
        const nodesInLevel = nodesByLevel[level]

        if (nodesInLevel.length <= 1) return // 只有一个节点不需要调整

        // 按X坐标排序节点
        const sortedNodes = [...nodesInLevel].sort((a, b) => nodePositions[a].x - nodePositions[b].x)

        // 检测并修复重叠
        for (let i = 1; i < sortedNodes.length; i++) {
          const currentNodeId = sortedNodes[i]
          const prevNodeId = sortedNodes[i - 1]
          const currentPos = nodePositions[currentNodeId]
          const prevPos = nodePositions[prevNodeId]

          // 计算当前节点左边缘与前一个节点右边缘之间的距离
          const distance = currentPos.x - prevPos.x
          const minRequiredDistance = NODE_WIDTH + NODE_MARGIN

          // 如果距离小于所需最小距离，向右移动当前节点
          if (distance < minRequiredDistance) {
            const adjustment = minRequiredDistance - distance
            currentPos.x += adjustment

            // 同时递归调整当前节点的所有子节点
            const adjustChildNodes = (nodeId: string, offsetX: number) => {
              const childIds = dialogMap.nodes[nodeId]?.children || []
              childIds.forEach((childId) => {
                if (nodePositions[childId]) {
                  nodePositions[childId].x += offsetX
                  adjustChildNodes(childId, offsetX)
                }
              })
            }

            adjustChildNodes(currentNodeId, adjustment)
          }
        }

        // 计算本层节点的中心位置
        const leftmostX = nodePositions[sortedNodes[0]].x
        const rightmostX = nodePositions[sortedNodes[sortedNodes.length - 1]].x
        const layerCenter = (leftmostX + rightmostX) / 2
        const desiredCenter = initialX

        // 如果层的中心与期望中心不同，整体移动该层所有节点及其子节点
        if (Math.abs(layerCenter - desiredCenter) > 10) {
          const offsetX = desiredCenter - layerCenter
          sortedNodes.forEach((nodeId) => {
            nodePositions[nodeId].x += offsetX

            // 同时调整所有子节点
            const adjustChildNodes = (nodeId: string, offsetX: number) => {
              const childIds = dialogMap.nodes[nodeId]?.children || []
              childIds.forEach((childId) => {
                if (nodePositions[childId]) {
                  nodePositions[childId].x += offsetX
                  adjustChildNodes(childId, offsetX)
                }
              })
            }

            adjustChildNodes(nodeId, offsetX)
          })
        }
      })

    // 创建节点
    Object.entries(dialogMap.nodes).forEach(([nodeId, node]) => {
      if (!nodePositions[nodeId]) return

      const { x, y } = nodePositions[nodeId]
      const isSelected = node.isSelected

      flowNodes.push({
        id: nodeId,
        type: 'dialogMapNode',
        data: {
          content: node.content,
          type: node.role,
          nodeId: nodeId,
          messageId: node.messageId,
          isSelected,
          modelId: node.modelId,
          model: node.model?.name || t('dialogMap.unknown_model'),
          modelInfo: node.model,
          onNodeClick: handleNodeClick,
          onAddBranch: handleAddBranch,
          onDeleteNode: handleDeleteNode,
          onNavigateToNode: handleNavigateToNode
        },
        position: { x, y }
      })

      // 创建与子节点的连接
      node.children.forEach((childId) => {
        // 检查是否为选中路径上的连接
        const isSelected = node.isSelected && dialogMap.nodes[childId].isSelected

        // 计算子节点位置与父节点的相对位置，以确定最佳连接点
        const childPosition = nodePositions[childId]
        const parentPosition = nodePositions[nodeId]

        // 默认连接类型
        let sourcePosition = Position.Bottom
        let targetPosition = Position.Top

        // 根据相对位置调整连接点
        if (childPosition && parentPosition) {
          const dx = childPosition.x - parentPosition.x

          // 如果子节点明显在父节点左侧，使用左右连接
          if (dx < -NODE_WIDTH / 2) {
            sourcePosition = Position.Left
            targetPosition = Position.Right
          }
          // 如果子节点明显在父节点右侧，使用右左连接
          else if (dx > NODE_WIDTH / 2) {
            sourcePosition = Position.Right
            targetPosition = Position.Left
          }
          // 否则保持默认的上下连接
        }

        flowEdges.push({
          id: `edge-${nodeId}-to-${childId}`,
          source: nodeId,
          target: childId,
          sourceHandle: null,
          targetHandle: null,
          data: {
            sourcePosition,
            targetPosition,
            isHorizontal:
              childPosition && parentPosition && Math.abs(childPosition.x - parentPosition.x) > NODE_WIDTH / 2
          },
          animated: isSelected,
          type: 'bezier',
          style: isSelected ? selectedEdgeStyle : commonEdgeStyle,
          markerEnd: isSelected
            ? {
                type: MarkerType.ArrowClosed,
                width: 12,
                height: 12,
                color: 'var(--color-primary)'
              }
            : {
                type: MarkerType.Arrow,
                width: 12,
                height: 12,
                color: 'var(--color-border-dark, #666)'
              }
        })
      })
    })

    return { nodes: flowNodes, edges: flowEdges }
  }, [dialogMap, handleNodeClick, handleAddBranch, handleDeleteNode, handleNavigateToNode, t])

  // 当对话地图数据变化时，更新流程图
  useEffect(() => {
    if (!loading && dialogMap) {
      const { nodes: flowNodes, edges: flowEdges } = buildDialogMapFlowData()
      setNodes(flowNodes)
      setEdges(flowEdges)
    }
  }, [loading, dialogMap, buildDialogMapFlowData, setNodes, setEdges])

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
              nodesDraggable={false}
              nodesConnectable={false}
              edgesFocusable={true}
              zoomOnDoubleClick={true}
              preventScrolling={true}
              elementsSelectable={true}
              selectNodesOnDrag={false}
              nodesFocusable={true}
              zoomOnScroll={true}
              panOnScroll={false}
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
      0 0 0 2px ${(props) => props.style?.borderColor || 'var(--color-border)'}80 !important;
    filter: brightness(1.02);
  }

  /* 添加点击动画效果 */
  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 4px var(--color-border-soft);
    transition: all 0.1s ease;
  }
`

// 定义节点组件样式
const NodeHeader = styled.div`
  font-weight: bold;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
  color: var(--color-text);
  display: flex;
  align-items: center;
  min-height: 32px;
`

const NodeAvatar = styled.span`
  margin-right: 10px;
  display: flex;
  align-items: center;

  .ant-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`

const NodeTitle = styled.span`
  flex: 1;
  font-size: 16px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const NodeContent = styled.div`
  margin: 2px 0;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-height: 1.5;
  word-break: break-word;
  font-size: 14px;
  padding: 3px;
`

const AddBranchButton = styled.button`
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 3px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    color: var(--color-primary);
    background-color: var(--color-primary-soft);
  }
`

export default DialogMap

import Iconfont from '@/components/iconfont';
import request from '@/services/request';
import useAppStore from '@/stores/app';
import { formatTime } from '@/utils/tools';
import { Box, Button, Flex, Text, UseDisclosureReturn } from '@chakra-ui/react';
import { ClearOutlineIcon, CloseIcon, WarnIcon } from '@sealos/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { produce } from 'immer';
import { useTranslation } from 'next-i18next';
import { useEffect, useState } from 'react';
import styles from './index.module.scss';

type NotificationItem = {
  metadata: {
    creationTimestamp: string;
    labels: {
      isRead: string;
    };
    name: string;
    namespace: string;
    uid: string;
  };
  spec: {
    from: string;
    message: string;
    timestamp: number;
    title: string;
    desktopPopup?: boolean;
    i18ns?: {
      zh?: {
        from: string;
        message: string;
        title: string;
      };
    };
  };
};

type TNotification = {
  disclosure: UseDisclosureReturn;
  onAmount: (amount: number) => void;
};

export default function Notification(props: TNotification) {
  const { t, i18n } = useTranslation();
  const { disclosure, onAmount } = props;
  const { installedApps, openApp } = useAppStore();
  const [readNotes, setReadNotes] = useState<NotificationItem[]>([]);
  const [unReadNotes, setUnReadNotes] = useState<NotificationItem[]>([]);

  const [MessageConfig, setMessageConfig] = useState<{
    activeTab: 'read' | 'unread';
    activePage: 'index' | 'detail';
    msgDetail?: NotificationItem;
    popupMessage?: NotificationItem;
  }>({
    activeTab: 'unread',
    activePage: 'index',
    msgDetail: undefined,
    popupMessage: undefined
  });

  const { refetch } = useQuery(['getNotifications'], () => request('/api/notification/list'), {
    onSuccess: (data) => {
      const messages = data?.data?.items as NotificationItem[];
      if (messages) {
        handleNotificationData(messages);
      }
    },
    refetchInterval: 5 * 60 * 1000
  });

  const handleNotificationData = (data: NotificationItem[]) => {
    const parseIsRead = (item: NotificationItem) =>
      JSON.parse(item?.metadata?.labels?.isRead || 'false');

    const unReadMessage = data.filter((item) => !parseIsRead(item));
    const readMessage = data.filter(parseIsRead);

    const compareByTimestamp = (a: NotificationItem, b: NotificationItem) =>
      b?.spec?.timestamp - a?.spec?.timestamp;

    unReadMessage.sort(compareByTimestamp);
    readMessage.sort(compareByTimestamp);

    if (unReadMessage?.[0]?.spec?.desktopPopup) {
      setMessageConfig(
        produce((draft) => {
          draft.popupMessage = unReadMessage[0];
        })
      );
    }

    onAmount(unReadMessage?.length || 0);
    setReadNotes(readMessage);
    setUnReadNotes(unReadMessage);
  };

  const notifications = MessageConfig.activeTab === 'unread' ? unReadNotes : readNotes;

  const readMsgMutation = useMutation({
    mutationFn: (name: string[]) => request.post('/api/notification/read', { name }),
    onSettled: () => refetch()
  });

  const goMsgDetail = (item: NotificationItem) => {
    if (MessageConfig.activeTab === 'unread') {
      readMsgMutation.mutate([item?.metadata?.name]);
    }
    setMessageConfig(
      produce((draft) => {
        draft.activePage = 'detail';
        draft.msgDetail = item;
        draft.popupMessage = undefined;
      })
    );
  };

  const markAllAsRead = () => {
    const names = unReadNotes?.map((item: NotificationItem) => item?.metadata?.name);
    readMsgMutation.mutate(names);
    setMessageConfig(
      produce((draft) => {
        draft.popupMessage = undefined;
      })
    );
  };

  const handleCharge = () => {
    const costCenter = installedApps.find((i) => i.key === 'system-costcenter');
    if (!costCenter) return;
    openApp(costCenter, {
      query: {
        openRecharge: 'true'
      }
    });
  };

  const resetMessageState = () => {
    setMessageConfig(
      produce((draft) => {
        draft.activeTab = 'unread';
        draft.activePage = 'index';
        draft.msgDetail = undefined;
      })
    );
    disclosure.onClose();
  };

  useEffect(() => {
    if (i18n.language) {
      refetch();
    }
  }, [i18n.language, refetch]);

  return disclosure.isOpen ? (
    <>
      <Box className={styles.bg} onClick={resetMessageState} cursor={'auto'}></Box>
      <Box className={clsx(styles.container)}>
        <Flex
          className={clsx(styles.title)}
          h={'32px'}
          alignItems={'center'}
          justifyContent={'center'}
          position="relative"
        >
          <Box
            className={clsx(styles.back_btn)}
            onClick={() =>
              setMessageConfig(
                produce((draft) => {
                  draft.activePage = 'index';
                })
              )
            }
            data-active={MessageConfig.activePage}
          >
            <Iconfont iconName="icon-left" color="#239BF2" width={32} height={32} />
          </Box>
          <Text>
            {MessageConfig.activePage === 'index'
              ? t('Message Center')
              : i18n.language === 'zh' && MessageConfig.msgDetail?.spec?.i18ns?.zh?.title
              ? MessageConfig.msgDetail?.spec?.i18ns?.zh?.title
              : MessageConfig.msgDetail?.spec?.title}
          </Text>
        </Flex>
        {MessageConfig.activePage === 'index' ? (
          <>
            <Flex alignItems={'center'}>
              <Box
                className={clsx(MessageConfig.activeTab === 'unread' && styles.active, styles.tab)}
                onClick={() =>
                  setMessageConfig(
                    produce((draft) => {
                      draft.activeTab = 'unread';
                    })
                  )
                }
              >
                {t('Unread')} ({unReadNotes?.length || 0})
              </Box>
              <Box
                ml={'12px'}
                className={clsx(MessageConfig.activeTab === 'read' && styles.active, styles.tab)}
                onClick={() =>
                  setMessageConfig(
                    produce((draft) => {
                      draft.activeTab = 'read';
                    })
                  )
                }
              >
                {t('Have Read')}
              </Box>
              <Button
                ml={'auto'}
                onClick={() => markAllAsRead()}
                variant={'white-bg-icon'}
                leftIcon={<ClearOutlineIcon color={'grayModern.600'} />}
                iconSpacing="4px"
              >
                <Text color={'#434F61'} className={styles.tab}>
                  {t('Read All')}
                </Text>
              </Button>
            </Flex>
            <Flex pt={'9px'} pb="12px" direction={'column'} h="430px" className={styles.scrollWrap}>
              {notifications?.map((item: NotificationItem) => {
                return (
                  <Flex
                    mt={'8px'}
                    direction={'column'}
                    className={clsx(styles.message)}
                    key={item?.metadata?.uid}
                    onClick={() => goMsgDetail(item)}
                  >
                    <Text className={styles.title}>
                      {i18n.language === 'zh' && item.spec?.i18ns?.zh?.title
                        ? item.spec?.i18ns?.zh?.title
                        : item?.spec?.title}
                    </Text>
                    <Text flexShrink={0} mt="4px" noOfLines={1} className={clsx(styles.desc)}>
                      {i18n.language === 'zh' && item.spec?.i18ns?.zh?.message
                        ? item.spec?.i18ns?.zh?.message
                        : item?.spec?.message}
                    </Text>
                    <Flex
                      mt="4px"
                      justifyContent={'space-between'}
                      className={clsx(styles.desc, styles.footer)}
                    >
                      <Text>
                        {t('From')}「
                        {i18n.language === 'zh' && item.spec?.i18ns?.zh?.from
                          ? item.spec?.i18ns?.zh?.from
                          : item?.spec?.from}
                        」
                      </Text>
                      <Text>
                        {formatTime((item?.spec?.timestamp || 0) * 1000, 'YYYY-MM-DD HH:mm')}
                      </Text>
                    </Flex>
                  </Flex>
                );
              })}
            </Flex>
          </>
        ) : (
          <Box
            h="430px"
            w="100%"
            mt="16px"
            p="16px"
            borderRadius={'12px'}
            backgroundColor="rgba(255, 255, 255, 0.9)"
          >
            <Flex
              className={clsx(styles.desc, styles.footer)}
              color="#717D8A"
              fontSize="10px"
              fontWeight="400"
            >
              <Text>
                {t('From')}「
                {i18n.language === 'zh' && MessageConfig.msgDetail?.spec?.i18ns?.zh?.from
                  ? MessageConfig.msgDetail?.spec?.i18ns?.zh?.from
                  : MessageConfig.msgDetail?.spec?.from}
                」
              </Text>
              <Box display={'inline-block'} ml={'auto'}>
                {formatTime(
                  (MessageConfig.msgDetail?.spec?.timestamp || 0) * 1000,
                  'YYYY-MM-DD HH:mm'
                )}
              </Box>
            </Flex>
            <Text
              whiteSpace="pre-wrap"
              mt="14px"
              fontSize="12px"
              fontWeight={400}
              color="#000000"
              h="300px"
              overflowY="auto"
            >
              {i18n.language === 'zh' && MessageConfig.msgDetail?.spec?.i18ns?.zh?.message
                ? MessageConfig.msgDetail?.spec?.i18ns?.zh?.message
                : MessageConfig.msgDetail?.spec?.message}
            </Text>
            {MessageConfig.msgDetail?.spec?.from === 'Debt-System' && (
              <Flex justifyContent={'center'} mt="26px">
                <Button
                  w="159px"
                  h="32px"
                  bg="#24282C"
                  borderRadius={'4px'}
                  color={'#FFF'}
                  fontSize={'12px'}
                  variant={'primary'}
                  onClick={() => {
                    resetMessageState();
                    handleCharge();
                  }}
                >
                  {t('Charge')}
                </Button>
              </Flex>
            )}
          </Box>
        )}
      </Box>
    </>
  ) : (
    <>
      {MessageConfig?.popupMessage && (
        <Box
          cursor={'default'}
          position={'absolute'}
          w="320px"
          h={'170px'}
          top={'48px'}
          right={'0px'}
          bg="rgba(255, 255, 255, 0.80)"
          backdropFilter={'blur(50px)'}
          boxShadow={'0px 15px 20px 0px rgba(0, 0, 0, 0.10)'}
          borderRadius={'12px 0px 12px 12px'}
          p="20px"
        >
          <Flex alignItems={'center'}>
            <WarnIcon />
            <Text fontSize={'16px'} fontWeight={600} color={'#24282C'} ml="10px">
              {i18n.language === 'zh' && MessageConfig.popupMessage?.spec?.i18ns?.zh?.title
                ? MessageConfig.popupMessage?.spec?.i18ns?.zh?.title
                : MessageConfig.popupMessage?.spec?.title}
            </Text>
            <CloseIcon
              ml="auto"
              cursor={'pointer'}
              onClick={() => {
                setMessageConfig(
                  produce((draft) => {
                    draft.popupMessage = undefined;
                  })
                );
              }}
            />
          </Flex>
          <Text
            whiteSpace="pre-wrap"
            mt="14px"
            fontSize="12px"
            fontWeight={400}
            color="#000000"
            className="overflow-auto"
            noOfLines={2}
            height={'36px'}
          >
            {i18n.language === 'zh' && MessageConfig.popupMessage?.spec?.i18ns?.zh?.message
              ? MessageConfig.popupMessage?.spec?.i18ns?.zh?.message
              : MessageConfig.popupMessage?.spec?.message}
          </Text>

          <Flex alignItems={'center'} justifyContent={'end'} mt="18px" gap="8px">
            <Button
              w="78px"
              h="32px"
              bg="#F8FAFB"
              borderRadius={'4px'}
              _hover={{ bg: '#F8FAFB' }}
              onClick={() => {
                const temp = MessageConfig.popupMessage;
                readMsgMutation.mutate([temp?.metadata?.name || '']);
                disclosure.onOpen();
                setMessageConfig(
                  produce((draft) => {
                    draft.activePage = 'detail';
                    draft.msgDetail = temp;
                    draft.popupMessage = undefined;
                  })
                );
              }}
            >
              {t('Detail')}
            </Button>
            <Button
              w="78px"
              h="32px"
              variant={'primary'}
              borderRadius={'4px'}
              onClick={() => {
                const temp = MessageConfig.popupMessage;
                readMsgMutation.mutate([temp?.metadata?.name || '']);
                setMessageConfig(
                  produce((draft) => {
                    draft.popupMessage = undefined;
                  })
                );
                handleCharge();
              }}
            >
              {t('Charge')}
            </Button>
          </Flex>
        </Box>
      )}
    </>
  );
}

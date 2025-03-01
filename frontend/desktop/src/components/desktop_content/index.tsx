import AppWindow from '@/components/app_window';
import MoreButton from '@/components/more_button';
import UserMenu from '@/components/user_menu';
import useAppStore from '@/stores/app';
import { TApp } from '@/types';
import { Box, Flex, Grid, GridItem, Image, Text, Icon, FlexProps, Button } from '@chakra-ui/react';
import { useTranslation } from 'next-i18next';
import dynamic from 'next/dynamic';
import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { createMasterAPP, masterApp } from 'sealos-desktop-sdk/master';
import IframeWindow from './iframe_window';
import styles from './index.module.scss';
import useDriver from '@/hooks/useDriver';

const TimeComponent = dynamic(() => import('./time'), {
  ssr: false
});

export default function DesktopContent(props: any) {
  const { t, i18n } = useTranslation();
  const { installedApps: apps, runningInfo, openApp, setToHighestLayerById } = useAppStore();
  const renderApps = apps.filter((item: TApp) => item?.displayType === 'normal');
  const [maxItems, setMaxItems] = useState(10);

  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>, item: TApp) => {
    e.preventDefault();
    if (item?.name) {
      openApp(item);
    }
  };

  /**
   * open app
   */
  const openDesktopApp = useCallback(
    ({
      appKey,
      query = {},
      messageData = {},
      pathname = '/'
    }: {
      appKey: string;
      query?: Record<string, string>;
      messageData?: Record<string, any>;
      pathname: string;
    }) => {
      const app = apps.find((item) => item.key === appKey);
      const runningApp = runningInfo.find((item) => item.key === appKey);
      if (!app) return;
      openApp(app, { query, pathname });
      if (runningApp) {
        setToHighestLayerById(runningApp.pid);
      }
      // post message
      const iframe = document.getElementById(`app-window-${appKey}`) as HTMLIFrameElement;
      if (!iframe) return;
      iframe.contentWindow?.postMessage(messageData, app.data.url);
    },
    [apps, openApp, runningInfo, setToHighestLayerById]
  );

  useEffect(() => {
    return createMasterAPP();
  }, []);

  useEffect(() => {
    return masterApp?.addEventListen('openDesktopApp', openDesktopApp);
  }, [openDesktopApp]);

  const { UserGuide, showGuide } = useDriver({ openDesktopApp });

  return (
    <Box
      id="desktop"
      className={styles.desktop}
      backgroundImage={'url(/images/background.svg)'}
      backgroundRepeat={'no-repeat'}
      backgroundSize={'cover'}
    >
      <Flex w="100%" h="100%" alignItems={'center'} flexDirection={'column'}>
        <Box mt="12vh" minW={'508px'}>
          <TimeComponent />
        </Box>
        {showGuide ? (
          <>
            <UserGuide />
            <Box
              position="fixed"
              top="0"
              left="0"
              width="100%"
              height="100%"
              backgroundColor="rgba(0, 0, 0, 0.7)" // 半透明黑色背景
              zIndex="11000" // 保证蒙层在最上层
            />
          </>
        ) : (
          <></>
        )}
        {/* desktop apps */}
        <Grid
          mt="50px"
          minW={'508px'}
          maxH={'300px'}
          templateRows={'repeat(2, 100px)'}
          templateColumns={'repeat(5, 72px)'}
          gap={'36px'}
        >
          {renderApps &&
            renderApps.slice(0, maxItems).map((item: TApp, index) => (
              <GridItem
                w="72px"
                h="100px"
                key={index}
                userSelect="none"
                cursor={'pointer'}
                onClick={(e) => handleDoubleClick(e, item)}
              >
                <Box
                  className={item.key}
                  w="72px"
                  h="72px"
                  p={'12px'}
                  border={'1px solid #FFFFFF'}
                  borderRadius={8}
                  boxShadow={'0px 1.16667px 2.33333px rgba(0, 0, 0, 0.2)'}
                  backgroundColor={'rgba(244, 246, 248, 0.9)'}
                >
                  <Image
                    width="100%"
                    height="100%"
                    src={item?.icon}
                    fallbackSrc="/images/sealos.svg"
                    alt="user avator"
                  />
                </Box>
                <Text
                  textShadow={'0px 1px 2px rgba(0, 0, 0, 0.4)'}
                  textAlign={'center'}
                  mt="8px"
                  color={'#FFFFFF'}
                  fontSize={'13px'}
                  lineHeight={'16px'}
                >
                  {item?.i18n?.[i18n?.language]?.name
                    ? item?.i18n?.[i18n?.language]?.name
                    : t(item?.name)}
                </Text>
              </GridItem>
            ))}
        </Grid>
        <MoreButton />
        <UserMenu />
      </Flex>
      {/* opened apps */}
      {runningInfo.map((process) => {
        return (
          <AppWindow key={process.pid} style={{ height: '100vh' }} pid={process.pid}>
            <IframeWindow pid={process.pid} />
          </AppWindow>
        );
      })}
    </Box>
  );
}

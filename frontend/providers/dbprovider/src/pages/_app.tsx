import { useEffect, useState } from 'react';
import Head from 'next/head';
import type { AppProps } from 'next/app';
import { ChakraProvider } from '@chakra-ui/react';
import { theme } from '@/constants/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Router from 'next/router';
import NProgress from 'nprogress'; //nprogress module
import { sealosApp, createSealosApp } from 'sealos-desktop-sdk/app';
import { EVENT_NAME } from 'sealos-desktop-sdk';
import { useConfirm } from '@/hooks/useConfirm';
import throttle from 'lodash/throttle';
import { useGlobalStore } from '@/store/global';
import { useLoading } from '@/hooks/useLoading';
import { useRouter } from 'next/router';
import { appWithTranslation, useTranslation } from 'next-i18next';
import { getLangStore, setLangStore } from '@/utils/cookieUtils';
import { getUserPrice, getDBVersion, StorageClassName, Domain, getEnv } from '@/store/static';

import 'nprogress/nprogress.css';
import 'react-day-picker/dist/style.css';
import '@/styles/reset.scss';
import { getAppEnv } from '@/api/platform';

//Binding events.
Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      cacheTime: 0
    }
  }
});

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { setScreenWidth, loading, setLastRoute } = useGlobalStore();
  const { Loading } = useLoading();
  const [refresh, setRefresh] = useState(false);
  const { openConfirm, ConfirmChild } = useConfirm({
    title: '跳转提示',
    content: '该应用不允许单独使用，点击确认前往 Sealos Desktop 使用。'
  });

  useEffect(() => {
    NProgress.start();
    const response = createSealosApp();

    (async () => {
      try {
        const res = await sealosApp.getSession();
        localStorage.setItem('session', JSON.stringify(res));
        console.log('app init success');
      } catch (err) {
        console.log('App is not running in desktop');
        if (!process.env.NEXT_PUBLIC_MOCK_USER) {
          localStorage.removeItem('session');
          openConfirm(() => {
            window.open(`https://${Domain}`, '_self');
          })();
        }
      }
    })();
    NProgress.done();

    return response;
  }, [openConfirm]);

  // add resize event
  useEffect(() => {
    const resize = throttle((e: Event) => {
      const documentWidth = document.documentElement.clientWidth || document.body.clientWidth;
      setScreenWidth(documentWidth);
    }, 200);
    window.addEventListener('resize', resize);
    const documentWidth = document.documentElement.clientWidth || document.body.clientWidth;
    setScreenWidth(documentWidth);

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, [setScreenWidth]);

  // init
  useEffect(() => {
    const changeI18n = async (data: any) => {
      const lastLang = getLangStore();
      const newLang = data.currentLanguage;
      if (lastLang !== newLang) {
        i18n?.changeLanguage(newLang);
        setLangStore(newLang);
        setRefresh((state) => !state);
      }
    };

    getUserPrice();
    getDBVersion();
    getEnv();
    (async () => {
      try {
        const lang = await sealosApp.getLanguage();
        changeI18n({
          currentLanguage: lang.lng
        });
      } catch (error) {
        changeI18n({
          currentLanguage: 'zh'
        });
      }
    })();

    return sealosApp?.addAppEventListen(EVENT_NAME.CHANGE_I18N, changeI18n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // record route
  useEffect(() => {
    return () => {
      setLastRoute(router.asPath);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  useEffect(() => {
    const lang = getLangStore() || 'zh';
    i18n?.changeLanguage?.(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, router.asPath]);

  // InternalAppCall
  const setupInternalAppCallListener = async () => {
    try {
      const envs = await getAppEnv();
      const event = async (e: MessageEvent) => {
        const whitelist = [`https://${envs?.domain}`];
        if (!whitelist.includes(e.origin)) {
          return;
        }
        try {
          if (e.data?.type === 'InternalAppCall' && e.data?.name) {
            router.push({
              pathname: '/app/detail',
              query: {
                name: e.data.name
              }
            });
          }
        } catch (error) {
          console.log(error, 'error');
        }
      };
      window.addEventListener('message', event);
      return () => window.removeEventListener('message', event);
    } catch (error) {}
  };
  useEffect(() => {
    setupInternalAppCallListener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Head>
        <title>Sealos DB Provider</title>
        <meta name="description" content="Generated by Sealos Team" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <QueryClientProvider client={queryClient}>
        <ChakraProvider theme={theme}>
          {/* <button
            onClick={() => {
              const lastLang = getLangStore();
              let lang = lastLang === 'en' ? 'zh' : 'en';
              if (lastLang !== lang) {
                i18n.changeLanguage(lang);
                setLangStore(lang);
                setRefresh((state) => !state);
              }
            }}
          >
            changeLanguage
          </button> */}
          <Component {...pageProps} />
          <ConfirmChild />
          <Loading loading={loading} />
        </ChakraProvider>
      </QueryClientProvider>
    </>
  );
}

export default appWithTranslation(App);

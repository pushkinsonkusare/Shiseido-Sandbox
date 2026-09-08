import { useLayoutEffect } from "react";
import AboutUsPage from "./pages/AboutUsPage/AboutUsPage";
import { AgentModeBar } from "./components/AgentModeBar/AgentModeBar";
import { AgentModeProvider, useAgentMode } from "./components/AgentModeBar/AgentModeContext";
import { MobileChrome } from "./components/MobileChrome/MobileChrome";
import { PageSkeleton } from "./components/PageSkeleton/PageSkeleton";
import { useDemoFrameFit } from "./hooks/useDemoFrameFit";
import { CatalogProvider } from "./catalog/CatalogContext";
import CheckoutPage from "./pages/CheckoutPage/CheckoutPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage/OrderConfirmationPage";
import OverviewPage from "./pages/OverviewPage/OverviewPage";
import ProductDetailPage from "./pages/ProductDetailPage/ProductDetailPage";
import ProductListingPage from "./pages/ProductListingPage/ProductListingPage";
import { SearchOverlay } from "./components/SearchOverlay/SearchOverlay";
import { SearchOverlayProvider } from "./components/SearchOverlay/SearchOverlayContext";
import ShoppingCartPage from "./pages/ShoppingCartPage/ShoppingCartPage";
import { SideBySideLayout } from "./components/SideBySideAssistant/SideBySideLayout";
import { SidecarDockLayout } from "./components/SidecarAssistant/SidecarDockLayout";
import { SiteGate } from "./components/SiteGate/SiteGate.tsx";
import StorefrontPage from "./pages/StorefrontPage/StorefrontPage";
import { PrototypeNavigationProvider, ROUTES, scrollAppToTop, usePrototypeNavigation } from "./prototypeRoutes";

function RoutedApp() {
  const { currentRoute, currentProductSlug, isPageLoading } = usePrototypeNavigation();

  useLayoutEffect(() => {
    scrollAppToTop();
  }, [currentRoute, currentProductSlug, isPageLoading]);

  if (isPageLoading) {
    return <PageSkeleton route={currentRoute} />;
  }

  switch (currentRoute) {
    case ROUTES.productListing:
      return <ProductListingPage />;
    case ROUTES.productDetail:
      return <ProductDetailPage />;
    case ROUTES.cart:
      return <ShoppingCartPage />;
    case ROUTES.checkout:
      return <CheckoutPage />;
    case ROUTES.orderConfirmation:
      return <OrderConfirmationPage />;
    case ROUTES.login:
      return <LoginPage />;
    case ROUTES.account:
      return <OverviewPage />;
    case ROUTES.about:
      return <AboutUsPage />;
    case ROUTES.home:
    default:
      return <StorefrontPage />;
  }
}

function DemoFrameFit() {
  const { viewportMode, mobileChrome } = useAgentMode();
  useDemoFrameFit(viewportMode, mobileChrome);
  return null;
}

function ModeAwareRoot() {
  const { mode } = useAgentMode();

  if (mode === "side-by-side") {
    return (
      <SideBySideLayout>
        <RoutedApp />
      </SideBySideLayout>
    );
  }

  if (mode === "assistant-only") {
    return (
      <SidecarDockLayout>
        <RoutedApp />
      </SidecarDockLayout>
    );
  }

  return <RoutedApp />;
}

function App() {
  return (
    <SiteGate>
      <AgentModeProvider>
        <PrototypeNavigationProvider>
          <CatalogProvider>
            <SearchOverlayProvider>
              <DemoFrameFit />
              <AgentModeBar />
              <ModeAwareRoot />
              <SearchOverlay />
              <MobileChrome />
            </SearchOverlayProvider>
          </CatalogProvider>
        </PrototypeNavigationProvider>
      </AgentModeProvider>
    </SiteGate>
  );
}

export default App;

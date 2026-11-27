// Root layout. The stylesheets keep the order of the original index.html:
// later files intentionally override earlier ones (ui-controls.css near the end).
import '../styles/theme.css';
import '../styles/icons.css'; // was @import at the top of style.css
import '../styles/style.css';
import '../styles/terminal.css';
import '../styles/world.css';
import '../styles/atlas.css';
import '../styles/newsroom.css';
import '../styles/ritual.css';
import '../styles/broker.css';
import '../styles/shell.css';
import '../styles/credit.css';
import '../styles/loan-desk.css';
import '../styles/loan-dice.css';
import '../styles/pixel-shell.css';
import '../styles/navigation.css';
import '../styles/friends.css';
import '../styles/community.css';
import '../styles/election.css';
import '../styles/status.css';
import '../styles/home-desk.css';
import '../styles/shop.css';
import '../styles/rehabilitation-art.css'; // was @import at the top of rehabilitation.css
import '../styles/rehabilitation.css';
import '../styles/salary-negotiation.css';
import '../styles/fortune.css';
import '../styles/day-report.css';
import '../styles/type-access.css';
import '../styles/scene-motion.css';
import '../styles/landing.css';
import '../styles/field-guide.css';
import '../styles/ui-controls.css';
import '../styles/order.css';
import '../styles/next-shell.css';

export const metadata = {
  title: '변기투자 · STALL STREET',
  description: '잠깐 자리 비운 사이 장이 열린다. 뉴스를 읽고 가상의 종목을 거래하는 픽셀 주식 게임.',
  icons: {icon: {url: '/art/logo.png', type: 'image/png'}},
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1b3128',
};

export default function RootLayout({children}) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard ships ~90 unicode-range subsets; serve them as-is from public/. */}
        <link rel="stylesheet" href="/art/fonts/pretendard/pretendard.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}

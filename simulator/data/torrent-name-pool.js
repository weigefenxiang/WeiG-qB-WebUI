const EN_PREFIX=['Open','Blue','Silent','Northern','Golden','Rapid','Clear','Deep','Bright','Urban','Classic','Digital','Parallel','Hidden','Infinite','Modern','Prime','Solar','Vector','Wild'];
const EN_SUBJECT=['Archive','Atlas','Dataset','Documentary','Library','Source','Collection','Workshop','Chronicle','Studio','Manual','Sessions','Footage','Research','Bundle','Compendium','Projects','Reference','Samples','Vault'];
const EN_VARIANT=['Collection 2026','Pack 1080p'];
const INTERNATIONAL=[
  '开源软件合集','纪录片资料库','古典音乐精选','城市摄影档案','编程课程资料',
  '開源軟體合集','紀錄片資料庫','古典音樂精選','城市攝影檔案','程式設計課程',
  'オープンソース資料集','ドキュメンタリー全集','クラシック音楽選集','都市写真アーカイブ','プログラミング教材',
  '오픈소스 자료 모음','다큐멘터리 컬렉션','클래식 음악 모음','도시 사진 아카이브','프로그래밍 강의',
  'Freie Software Sammlung','Dokumentarfilm Archiv','Klassik Sammlung','Stadtfotografie Archiv','Programmierkurs Material',
  'Collection logiciel libre','Archives documentaires','Sélection musique classique','Archives photo urbaines','Cours de programmation',
  'Colección de software libre','Archivo documental','Selección de música clásica','Archivo de fotografía urbana','Curso de programación',
  'Coleção de software livre','Arquivo de documentários','Seleção de música clássica','Arquivo de fotografia urbana','Curso de programação',
  'Коллекция свободного ПО','Архив документальных фильмов','Сборник классической музыки','Архив городской фотографии','Курс программирования'
];
const INTL_VARIANT=['2024','2025','2026','Vol. 1','Complete'];
const english=Array.from({length:800},(_,i)=>`${EN_PREFIX[i%EN_PREFIX.length]} ${EN_SUBJECT[Math.floor(i/EN_PREFIX.length)%EN_SUBJECT.length]} · ${EN_VARIANT[Math.floor(i/(EN_PREFIX.length*EN_SUBJECT.length))%EN_VARIANT.length]}`);
const international=Array.from({length:200},(_,i)=>`${INTERNATIONAL[i%INTERNATIONAL.length]} · ${INTL_VARIANT[Math.floor(i/INTERNATIONAL.length)%INTL_VARIANT.length]}`);
export const TORRENT_NAME_POOL=Object.freeze([...english,...international]);

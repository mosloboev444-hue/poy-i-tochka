export type LocalSong = {
  title: string;
  artist: string;
  genre: string;
};

/** Small built-in metadata catalog. Audio and lyrics stay online; this works offline. */
export const LOCAL_SONGS: LocalSong[] = [
  { title: "Медведь", artist: "Король и Шут", genre: "Русский рок" },
  { title: "Лесник", artist: "Король и Шут", genre: "Русский рок" },
  { title: "Кукла колдуна", artist: "Король и Шут", genre: "Русский рок" },
  { title: "Проклятый старый дом", artist: "Король и Шут", genre: "Русский рок" },
  { title: "Танец злобного гения", artist: "Король и Шут", genre: "Русский рок" },
  { title: "Группа крови", artist: "Кино", genre: "Русский рок" },
  { title: "Звезда по имени Солнце", artist: "Кино", genre: "Русский рок" },
  { title: "Пачка сигарет", artist: "Кино", genre: "Русский рок" },
  { title: "Кукушка", artist: "Кино", genre: "Русский рок" },
  { title: "Восьмиклассница", artist: "Кино", genre: "Русский рок" },
  { title: "Что такое осень", artist: "ДДТ", genre: "Русский рок" },
  { title: "Белая река", artist: "ДДТ", genre: "Русский рок" },
  { title: "Последняя осень", artist: "ДДТ", genre: "Русский рок" },
  { title: "Трасса Е-95", artist: "Алиса", genre: "Русский рок" },
  { title: "Всё это рок-н-ролл", artist: "Алиса", genre: "Русский рок" },
  { title: "Выхода нет", artist: "Сплин", genre: "Русский рок" },
  { title: "Романс", artist: "Сплин", genre: "Русский рок" },
  { title: "Орбит без сахара", artist: "Сплин", genre: "Русский рок" },
  { title: "Крылья", artist: "Наутилус Помпилиус", genre: "Русский рок" },
  { title: "Скованные одной цепью", artist: "Наутилус Помпилиус", genre: "Русский рок" },
  { title: "Конь", artist: "Любэ", genre: "Русская эстрада" },
  { title: "Давай за...", artist: "Любэ", genre: "Русская эстрада" },
  { title: "Комбат", artist: "Любэ", genre: "Русская эстрада" },
  { title: "WWW", artist: "Ленинград", genre: "Русская эстрада" },
  { title: "Экспонат", artist: "Ленинград", genre: "Русская эстрада" },
  { title: "Позови меня с собой", artist: "Алла Пугачёва", genre: "Русская эстрада" },
  { title: "Миллион алых роз", artist: "Алла Пугачёва", genre: "Русская эстрада" },
  { title: "Тучи", artist: "Иванушки International", genre: "Русская эстрада" },
  { title: "Красивая", artist: "Иванушки International", genre: "Русская эстрада" },
  { title: "Владивосток 2000", artist: "Мумий Тролль", genre: "Русский рок" },
  { title: "Bohemian Rhapsody", artist: "Queen", genre: "Зарубежное" },
  { title: "We Will Rock You", artist: "Queen", genre: "Зарубежное" },
  { title: "Don't Stop Me Now", artist: "Queen", genre: "Зарубежное" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana", genre: "Зарубежное" },
  { title: "Come as You Are", artist: "Nirvana", genre: "Зарубежное" },
  { title: "Numb", artist: "Linkin Park", genre: "Зарубежное" },
  { title: "In the End", artist: "Linkin Park", genre: "Зарубежное" },
  { title: "Believer", artist: "Imagine Dragons", genre: "Зарубежное" },
  { title: "Radioactive", artist: "Imagine Dragons", genre: "Зарубежное" },
  { title: "Beggin'", artist: "Måneskin", genre: "Зарубежное" },
  { title: "Zitti e buoni", artist: "Måneskin", genre: "Зарубежное" },
  { title: "Bad Guy", artist: "Billie Eilish", genre: "Зарубежное" },
  { title: "Someone Like You", artist: "Adele", genre: "Зарубежное" },
  { title: "Rolling in the Deep", artist: "Adele", genre: "Зарубежное" },
  { title: "Shape of You", artist: "Ed Sheeran", genre: "Зарубежное" },
  { title: "Perfect", artist: "Ed Sheeran", genre: "Зарубежное" },
  { title: "Калинка", artist: "Русская народная", genre: "Народные" },
  { title: "Во поле берёза стояла", artist: "Русская народная", genre: "Народные" },
  { title: "Ой, цветёт калина", artist: "Русская народная", genre: "Народные" },
  { title: "Катюша", artist: "Русская народная", genre: "Народные" }
];

export const LOCAL_GENRES = ["Все", "Русский рок", "Русская эстрада", "Зарубежное", "Народные"];

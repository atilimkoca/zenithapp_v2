/**
 * Utility functions for translating lesson data based on current locale
 */

// Function to translate lesson content based on locale
export const translateLessonData = (lesson, t, locale) => {
  if (!lesson) return lesson;

  const translatedLesson = { ...lesson };

  // Translate lesson title/name
  if (lesson.title) {
    translatedLesson.title = t(`lessonTypes.${lesson.title}`) || lesson.title;
  }

  // Translate lesson type name if it exists
  if (lesson.type) {
    translatedLesson.type = t(`lessonTypes.${lesson.type}`) || lesson.type;
  }

  // Translate lesson description
  if (lesson.description) {
    translatedLesson.description = t(`lessonDescriptions.${lesson.description}`) || lesson.description;
  }

  // Translate training type if it exists
  if (lesson.trainingType) {
    translatedLesson.trainingType = t(`lessonTypes.${lesson.trainingType}`) || lesson.trainingType;
  }

  // Translate lesson type info if it exists
  if (lesson.lessonTypeInfo) {
    translatedLesson.lessonTypeInfo = {
      ...lesson.lessonTypeInfo,
      name: t(`lessonTypes.${lesson.lessonTypeInfo.name}`) || lesson.lessonTypeInfo.name,
      description: lesson.lessonTypeInfo.description ? 
        (t(`lessonDescriptions.${lesson.lessonTypeInfo.description}`) || lesson.lessonTypeInfo.description) :
        lesson.lessonTypeInfo.description
    };
  }

  return translatedLesson;
};

// Function to translate an array of lessons
export const translateLessonsArray = (lessons, t, locale) => {
  if (!Array.isArray(lessons)) return lessons;
  
  return lessons.map(lesson => translateLessonData(lesson, t, locale));
};

// Function to translate grouped lessons data
export const translateGroupedLessons = (groupedLessons, t, locale) => {
  if (!Array.isArray(groupedLessons)) return groupedLessons;
  
  return groupedLessons.map(group => ({
    ...group,
    lessons: translateLessonsArray(group.lessons, t, locale)
  }));
};

// Function to translate lesson types array
export const translateLessonTypes = (lessonTypes, t, locale) => {
  if (!Array.isArray(lessonTypes)) return lessonTypes;
  
  return lessonTypes.map(type => ({
    ...type,
    name: t(`lessonTypes.${type.name}`) || type.name,
    description: type.description ? 
      (t(`lessonDescriptions.${type.description}`) || type.description) :
      type.description
  }));
};
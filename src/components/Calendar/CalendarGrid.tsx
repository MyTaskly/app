import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import CalendarDay from './CalendarDay';
import { Task } from '../../services/taskService';

export interface CalendarGridProps {
  selectedDate: string;
  tasks: Task[];
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

interface DayInfo {
  date: string | null;
  day: string;
  hasTask?: boolean;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  selectedDate,
  tasks,
  onSelectDate,
  onPreviousMonth,
  onNextMonth
}) => {
  // Gruppo gli impegni per data
  const groupTasksByDate = () => {
    const groupedTasks: Record<string, Task[]> = {};
    
    tasks.forEach(task => {
      // Escludi i task senza data di scadenza
      if (!task.end_time) {
        return;
      }
      
      const taskDate = dayjs(task.end_time).format('YYYY-MM-DD');
        
      if (!groupedTasks[taskDate]) {
        groupedTasks[taskDate] = [];
      }
      
      groupedTasks[taskDate].push(task);
    });
    
    return groupedTasks;
  };

  // Funzione per determinare la priorità più alta tra i task di un giorno
  const getHighestPriorityColor = (date: string) => {
    const tasksForDay = groupTasksByDate()[date] || [];
    
    // Se non ci sono task, ritorna un colore neutro
    if (tasksForDay.length === 0) {
      return 'transparent';
    }
    
    // Pesi delle priorità (più alto = più importante)
    const priorityWeights: Record<string, number> = {
      'Alta': 3,
      'Media': 2,
      'Bassa': 1,
      'default': 0
    };      // Colori delle priorità (gradiente di scurezza)
    const priorityColors: Record<string, string> = {
      'Alta': 'rgba(0, 0, 0, 0.12)',        // Nero più evidente per alta priorità
      'Media': 'rgba(51, 51, 51, 0.08)',    // Grigio scuro per media priorità
      'Bassa': 'rgba(102, 102, 102, 0.05)', // Grigio medio per bassa priorità
      'default': 'transparent'
    };
    
    // Trova la priorità più alta tra i task del giorno
    let highestPriority = 'default';
    let highestWeight = -1;
    
    tasksForDay.forEach(task => {
      const priority = task.priority || 'default';
      const weight = priorityWeights[priority] || 0;
      
      if (weight > highestWeight) {
        highestWeight = weight;
        highestPriority = priority;
      }
    });
    
    return priorityColors[highestPriority];
  };
  
  // Ottieni il numero di task per un giorno specifico
  const getTaskCountForDay = (date: string) => {
    const tasksForDay = groupTasksByDate()[date] || [];
    return tasksForDay.length;
  };

  // Genero i giorni per il calendario
  const generateCalendarDays = (): DayInfo[] => {
    const daysInMonth = dayjs(selectedDate).daysInMonth();
    const currentMonth = dayjs(selectedDate).month();
    const currentYear = dayjs(selectedDate).year();
    const firstDayOfMonth = dayjs(`${currentYear}-${currentMonth + 1}-01`).day();
    
    const days: DayInfo[] = [];
    
    // Aggiungo giorni vuoti per allineare il calendario al primo giorno della settimana
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ date: null, day: '' });
    }
    
    // Aggiungo i giorni del mese
    for (let i = 1; i <= daysInMonth; i++) {
      const date = dayjs(`${currentYear}-${currentMonth + 1}-${i}`).format('YYYY-MM-DD');
      days.push({
        date,
        day: i.toString(),
        hasTask: groupTasksByDate()[date]?.length > 0
      });
    }
    
    return days;
  };

  return (
    <View>
      {/* Intestazione del calendario con navigazione */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={onPreviousMonth} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <Text style={styles.calendarMonthTitle}>
          {dayjs(selectedDate).format('MMMM YYYY')}
        </Text>
        
        <TouchableOpacity onPress={onNextMonth} style={{ padding: 8 }}>
          <Ionicons name="chevron-forward" size={24} color="#000000" />
        </TouchableOpacity>
      </View>
      
      {/* Giorni della settimana */}
      <View style={styles.weekdaysRow}>
        {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day, index) => (
          <Text key={index} style={styles.weekdayText}>
            {day}
          </Text>
        ))}
      </View>
      
      {/* Griglia del calendario */}
      <View style={styles.calendarGrid}>
        {generateCalendarDays().map((day, index) => (
          <CalendarDay
            key={index}
            day={day.day}
            date={day.date}
            isSelected={day.date === selectedDate}
            hasTask={!!day.hasTask}
            taskCount={day.date ? getTaskCountForDay(day.date) : 0}
            priorityColor={day.date ? getHighestPriorityColor(day.date) : 'transparent'}
            onSelectDate={onSelectDate}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  calendarMonthTitle: {
    fontSize: 22,
    fontWeight: "300",
    color: "#000000",
    fontFamily: "System",
    letterSpacing: -0.8,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 5,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    fontWeight: "500",
    color: "#666666",
    fontSize: 14,
    fontFamily: "System",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    paddingHorizontal: 5,
  },
});

export default CalendarGrid;
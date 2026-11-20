CREATE DATABASE IF NOT EXISTS registration;
USE registration;

CREATE TABLE faculty (
  faculty_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name  VARCHAR(50) NOT NULL,
  email      VARCHAR(100),
  department VARCHAR(100)
);
CREATE TABLE course (
  course_id   INT AUTO_INCREMENT PRIMARY KEY,
  course_code VARCHAR(20) NOT NULL,
  title       VARCHAR(100) NOT NULL,
  credits     INT NOT NULL DEFAULT 3
);
CREATE TABLE student (
  student_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name  VARCHAR(50) NOT NULL,
  email      VARCHAR(100),
  major      VARCHAR(100)
);
CREATE TABLE section (
  section_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id  INT NOT NULL,
  faculty_id INT,
  semester   VARCHAR(20) NOT NULL,
  room       VARCHAR(20),
  capacity   INT DEFAULT 30,
  FOREIGN KEY (course_id)  REFERENCES course(course_id)   ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL
);
CREATE TABLE enrollment (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  section_id INT NOT NULL,
  grade      VARCHAR(2),
  FOREIGN KEY (student_id) REFERENCES student(student_id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES section(section_id) ON DELETE CASCADE
);

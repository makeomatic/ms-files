# redis-filtered-sort

## Overview and Motivation

The high speed of reading Redis allows to quickly get information on known keys. 

Things get more complicated when need to select one specific page of a large list with sorting and filtering.

Filtering and sorting of large lists in Redis cluster mode requires several phases and collecting data from the multiple sets.

This can be time-consuming, so to speed up this procedure, need to speed up each phase of data collection.

## Solution variants

There are several solutions to this problem. Each variant carries a certain complexity of revision or upgrating of the system.

#### The replacing Redis with KeyDb

Redis is single threaded with the command queue. Lua scripts actually use this queue, and while the current script is executed all other commands are waiting.

KeyDb is natively multithreaded and can replace Redis without changing the database format, but with better utilization of the processor cores. And there don't have to change the code on the client side.

The downside is that the project is still young and under high loads can cause situations that would not have arisen with Redis.

#### The using MongoDb with Redis

Redis can be used as a very fast metadata storage, and MongoDb can be used to quickly select the required list of keys according to specified filters.

To reduce the amount of the storage in Redis and speed up the selection, keys can be generated in the form of a calculated hash value, and in MongoDb this keys can be mapped to a set of values for the sorting and the filtering.

To ensure synchronization between the databases, the code of the writing and the reading data operations will need to be modified. 

If a Redis record has a TTL set, then the corresponding TTL must be set in MongoDb as well.

#### Use own Redis module

Since the entire filtering and sorting process can take a long time, it is wise to periodically let other commands to be executed.

It is necessary to use the Global Blocking and Thread Safety Contexts in the filtering and sorting process algorithm to achieve better throughput.

